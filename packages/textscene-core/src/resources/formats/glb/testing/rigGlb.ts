/**
 * A binary glTF of a rig: the node Armature holds the joint Hip, which holds the mesh Sword, and the
 * skinned mesh Body. Godot's importer builds a Skeleton3D below Armature that holds Body, and a
 * BoneAttachment3D named Hip that holds Sword.
 */

import { nodesGlb } from './nodesGlb';

export const RIG_GLB = nodesGlb(
  [
    { name: 'Armature', children: [1, 2] },
    { name: 'Hip', children: [3] },
    { name: 'Body', mesh: 0, skin: 0 },
    { name: 'Sword', mesh: 0 },
  ],
  { skins: [{ joints: [1] }] }
);
