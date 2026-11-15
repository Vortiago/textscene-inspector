/**
 * The hook host: a component reads resources on one snapshot of the loader, renders again only
 * when a file one of its reads touched loads, fails or reloads, and leaves the request, the pin
 * and the **Missing resource** report to this host. A read never suspends and never throws.
 */

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useByValue } from '../../r3f/hooks/useByValue';
import { useSceneResources, type SceneResources } from '../../r3f/SceneResourcesContext';
import { subscribeToNothing } from '../../utils/subscribeToNothing';
import { hasUnsettledFile, useMissingFiles, useStableEntries } from '../useLoadedFiles';
import { usePendingWhile } from '../usePendingWhile';
import { useResourceLoader } from '../useResource';
import { loaderSnapshots, type SnapshotSource } from './loaderSnapshots';
import { NONE, type Read, type ResourceKind, type ResourceSnapshot } from './read';
import { snapshotOver } from './snapshot';
import { nodeReference, sameReference, type ScopedReference } from './scopedReference';

/** With no loader, every file is missing, as `useResource` answers outside its provider. */
const NO_PARSED_FILES = { getCached: () => null };
const NO_LOADER_SNAPSHOT = snapshotOver(NO_PARSED_FILES);
const NO_FILES = new Map<string, never>();
const NO_LOADER: SnapshotSource = {
  current: () => NO_LOADER_SNAPSHOT,
  restart: () => {},
  parsedFiles: () => NO_PARSED_FILES,
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

/**
 * The read of a reference a component holds: a slot of a decoded value (`Follow.reference`), or
 * a node's own property ({@link useNodeReference}). Null reads as `none`. The read keeps its
 * identity while the reference holds the same fields, so a caller may build it in render.
 */
export function useReferencedResource<T>(reference: ScopedReference | null, kind: ResourceKind<T>): Read<T> {
  const held = useByValue(reference, sameReference);
  return useSnapshotHost(
    useCallback((snapshot: ResourceSnapshot) => (held ? snapshot.read(held, kind) : NONE), [held, kind])
  );
}

/** `ref`, a property of a node that `scope` wrote, as a reference for {@link useReferencedResource}. */
export function useNodeReference(ref: string | undefined, scope: SceneResources): ScopedReference {
  return useMemo(() => nodeReference(ref, scope), [ref, scope]);
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
  return useSnapshotHost(
    useCallback(
      (snapshot: ResourceSnapshot) => readAll((ref, kind) => snapshot.read(nodeReference(ref, scope), kind)),
      [readAll, scope]
    )
  );
}

/**
 * `read` on the loader's current snapshot, run again when a file it touched loads, fails or
 * reloads. The host requests and pins each file the read touched, and reports the missing ones.
 * The caller keeps `read` stable while its inputs hold: a new `read` starts a new snapshot.
 *
 * @canonical Code with no hooks that reads resources, run by a component
 */
export function useSnapshotHost<R>(read: (snapshot: ResourceSnapshot) => R): R {
  const loader = useResourceLoader();
  // One source for each loader, so a file that reloads keeps its last answer for a new read.
  const source = useMemo(() => (loader ? loaderSnapshots(loader) : NO_LOADER), [loader]);
  // A new read starts a new snapshot: one that kept the last read's files would go on pinning and
  // reporting a file the reader no longer reads.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `read` is the trigger, not an input.
  useMemo(() => source.restart(), [source, read]);
  const snapshot = useSyncExternalStore(source.subscribe, source.current, source.current);
  const result = useMemo(() => read(snapshot), [snapshot, read]);
  const files = useStableEntries(new Map(source.files()));
  // After every commit: a read may have touched a file the last request did not see.
  useEffect(() => source.request());
  useMissingFiles(files);
  usePendingWhile(loader !== null && hasUnsettledFile(files));
  return result;
}
