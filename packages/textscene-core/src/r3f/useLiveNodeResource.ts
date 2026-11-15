/**
 * The read of a property of the component's own node on the live files, the snapshot the live tree
 * and its passes read: a file that a pass and the component both read loads once and answers once.
 */

import { useCallback } from 'react';
import { nodeReference, type Read, type ResourceKind, type ResourceSnapshot } from '../resources/reading';
import { useSceneResources } from './SceneResourcesContext';
import { useLiveFilesRead } from './useLiveSceneTree';

/** `ref`, resolved in the tables of the file that wrote the component's node, read as `kind`. */
export function useLiveNodeResource<T>(ref: string | undefined, kind: ResourceKind<T>): Read<T> {
  const scope = useSceneResources();
  const read = useCallback(
    (snapshot: ResourceSnapshot) => snapshot.read(nodeReference(ref, scope), kind),
    [ref, scope, kind]
  );
  return useLiveFilesRead(read, sameRead);
}

/** Whether two reads give the same answer: the same value, or the same reason it is unavailable. */
function sameRead<T>(a: Read<T>, b: Read<T>): boolean {
  if (a.status === 'unavailable' && b.status === 'unavailable') return a.reason === b.reason;
  return a.status === b.status && a.value === b.value;
}
