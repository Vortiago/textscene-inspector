/**
 * A node's target registered the way `NodeDispatcher` registers it: an unnamed wrapper group in the
 * selection's node-object map, around the node's own named content. A driver test that mounts no
 * dispatcher mounts its targets this way, so they bind by path. Test-only: the build excludes the
 * `testing/` directories under `src`.
 */
import { useCallback, type ReactNode } from 'react';
import type * as THREE from 'three';
import { useSelection } from '../contexts/SelectionContext';

export function RegisteredNode({ path, children }: { path: string; children: ReactNode }) {
  const { registerNodeObject, unregisterNodeObject } = useSelection();
  const wrapperRef = useCallback(
    (object: THREE.Object3D | null) => {
      if (object) registerNodeObject(path, object);
      else unregisterNodeObject(path);
    },
    [path, registerNodeObject, unregisterNodeObject]
  );
  return <group ref={wrapperRef}>{children}</group>;
}
