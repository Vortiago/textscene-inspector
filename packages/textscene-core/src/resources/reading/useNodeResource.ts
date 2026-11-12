/**
 * The hook host: a component reads resources on one snapshot of the loader, renders again only
 * when a file one of its reads touched loads, fails or reloads, and leaves the request, the pin
 * and the **Missing resource** report to this host. A read never suspends and never throws.
 */

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useSceneResources } from '../../r3f/SceneResourcesContext';
import { subscribeToNothing } from '../../utils/subscribeToNothing';
import { hasUnsettledFile, useMissingFiles, useStableEntries } from '../useLoadedFiles';
import { usePendingWhile } from '../usePendingWhile';
import { useResourceLoader } from '../useResource';
import { loaderSnapshots, type SnapshotSource } from './loaderSnapshots';
import type { Read, ResourceKind, ResourceSnapshot } from './read';
import { snapshotOver } from './snapshot';
import { nodeReference } from './scopedReference';

/** With no loader, every file is missing, as `useResource` answers outside its provider. */
const NO_LOADER_SNAPSHOT = snapshotOver({ getCached: () => null });
const NO_FILES = new Map<string, never>();
const NO_LOADER: SnapshotSource = {
  current: () => NO_LOADER_SNAPSHOT,
  request: () => {},
  subscribe: subscribeToNothing,
  files: () => NO_FILES,
};

/**
 * The read of a component: `ref` is a property of the component's own node, resolved in the
 * tables of the file that wrote it. The component that calls it must be the one dispatched for
 * the node. It runs the same hooks whatever the reference holds.
 *
 * @canonical A resource property that names a SubResource or an ExtResource
 */
export function useNodeResource<T>(ref: string | undefined, kind: ResourceKind<T>): Read<T> {
  return useSnapshotRead(useCallback((read) => read(ref, kind), [ref, kind]));
}

/** One read of a property of the component's own node: the reference and the kind. */
export type NodeRead = <T>(ref: string | undefined, kind: ResourceKind<T>) => Read<T>;

/**
 * Everything `readAll` reads, on one snapshot, as {@link useNodeResource} reads one property. The
 * result keeps its identity until a file a read touched changes or `readAll` does, so the caller
 * wraps `readAll` in `useCallback`.
 */
export function useSnapshotRead<R>(readAll: (read: NodeRead) => R): R {
  const scope = useSceneResources();
  const read = useCallback(
    (snapshot: ResourceSnapshot) => readAll((ref, kind) => snapshot.read(nodeReference(ref, scope), kind)),
    [readAll, scope]
  );
  const loader = useResourceLoader();
  // One source for each read: a source records every file its snapshot read, so a source kept
  // across a new read would go on pinning and reporting a file the reader no longer reads.
  const source = useMemo(
    () => (loader ? loaderSnapshots(loader) : NO_LOADER),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new read starts a new source.
    [loader, read]
  );
  const snapshot = useSyncExternalStore(source.subscribe, source.current, source.current);
  const result = useMemo(() => read(snapshot), [snapshot, read]);
  const files = useStableEntries(new Map(source.files()));
  // After every commit: a read may have touched a file the last request did not see.
  useEffect(() => source.request());
  useMissingFiles(files);
  usePendingWhile(loader !== null && hasUnsettledFile(files));
  return result;
}
