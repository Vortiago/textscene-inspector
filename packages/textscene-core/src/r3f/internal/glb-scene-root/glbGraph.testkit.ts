/**
 * A glTF-shaped THREE graph from `parent/child` paths, shared by the GLB-override suites so they
 * test one shape. Nodes are `Mesh`, the type override paths target, and carry the tags of a loaded glTF.
 */

import * as THREE from 'three';
import { tagAsLoadedGlb, type LoadedGlbOptions } from '../../../resources/formats/glb/testing/loadedGlbTags';

export function buildTestGlbGraph(paths: readonly string[], options?: LoadedGlbOptions): THREE.Object3D {
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
  tagAsLoadedGlb(root, options);
  return root;
}

/**
 * Adds Armature > Hip (a joint) > Sword to `root`, and tags the graph as a loaded glTF again. Godot
 * makes it Armature > Skeleton3D > a BoneAttachment3D for Hip, which holds Sword.
 */
export function addBoneRig(root: THREE.Object3D): { armature: THREE.Object3D; sword: THREE.Object3D } {
  const armature = Object.assign(new THREE.Group(), { name: 'Armature' });
  const hip = Object.assign(new THREE.Bone(), { name: 'Hip' });
  const sword = Object.assign(new THREE.Mesh(), { name: 'Sword' });
  hip.add(sword);
  armature.add(hip);
  root.add(armature);
  tagAsLoadedGlb(root);
  return { armature, sword };
}
