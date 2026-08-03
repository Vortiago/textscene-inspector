/**
 * Build a THREE graph from `parent/child` path strings, for the GLB-override
 * suites.
 *
 * Both `matchGlbTarget` and `applyGlbNodeOverrides` are tested against a graph
 * shaped like a loaded glTF, and hand-building one per suite is the kind of
 * duplication that lets two tests drift into testing different shapes. Nodes are
 * `Mesh` because that is what the override paths actually target — and a `Mesh`
 * IS an `Object3D`, so path-matching tests read the same.
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
