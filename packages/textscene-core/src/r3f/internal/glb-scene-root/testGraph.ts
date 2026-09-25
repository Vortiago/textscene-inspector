/**
 * A glTF-shaped THREE graph from `parent/child` paths, shared by the GLB-override suites so they
 * test one shape. Nodes are `Mesh`, the type override paths target.
 */

import * as THREE from 'three';

export function buildTestGlbGraph(paths: readonly string[]): THREE.Object3D {
  const root = new THREE.Object3D();
  root.name = 'Scene';
  for (const path of paths) {
    let node: THREE.Object3D = root;
    for (const segment of path.split('/')) {
      let next = node.children.find((c) => c.name === segment);
      if (!next) {
        next = new THREE.Mesh();
        next.name = segment;
        node.add(next);
      }
      node = next;
    }
  }
  return root;
}
