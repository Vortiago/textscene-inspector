/**
 * The hook host: a component reads resources on one snapshot of the loader, renders again only
 * when a file one of its reads touched loads, fails or reloads, and leaves the request, the pin
 * and the **Missing resource** report to this host. A read never suspends and never throws.
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useSceneResources } from '../../r3f/SceneResourcesContext';
import { subscribeToNothing } from '../../utils/subscribeToNothing';
import { hasUnsettledFile, useMissingFiles, useStableEntries } from '../useLoadedFiles';
import { usePendingWhile } from '../usePendingWhile';
import { useResourceLoader } from '../useResource';
import { loaderSnapshots, type SnapshotSource } from './loaderSnapshots';
import type { Read, ResourceKind } from './read';
import { snapshotOver } from './snapshot';
import { nodeReference, type ScopedReference } from './scopedReference';

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
  const scope = useSceneResources();
  const reference = useMemo(() => nodeReference(ref, scope), [ref, scope]);
  return useSnapshotRead(reference, kind);
}

/** The read of `reference` on the component's snapshot, which moves when a file the read touched changes. */
function useSnapshotRead<T>(reference: ScopedReference, kind: ResourceKind<T>): Read<T> {
  const loader = useResourceLoader();
  const source = useMemo(() => (loader ? loaderSnapshots(loader) : NO_LOADER), [loader]);
  const snapshot = useSyncExternalStore(source.subscribe, source.current, source.current);
  const read = useMemo(() => snapshot.read(reference, kind), [snapshot, reference, kind]);
  const files = useStableEntries(new Map(source.files()));
  // After every commit: a read may have touched a file the last request did not see.
  useEffect(() => source.request());
  useMissingFiles(files);
  usePendingWhile(loader !== null && hasUnsettledFile(files));
  return read;
}
