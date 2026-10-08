/**
 * The name and role Godot's importer gives each glTF node, on the object GLTFLoader builds for it.
 * GLTFLoader spells a name its own way (`Cube.001` becomes `Cube001`, a repeat `Cube_1`), so a
 * scene's node path into the glTF matches the Godot name. Tags in `userData`, which a clone copies,
 * carry them.
 */

import type * as THREE from 'three';
import type { GLTFReference } from 'three/addons/loaders/GLTFLoader.js';
import type { GltfNodeName, GltfNodeRole } from '../../../godot/gltfNodeNames';
import { isMeshInstance } from './meshInstances';

const GODOT_NAME_KEY = 'textsceneGodotName';
const GODOT_ROLE_KEY = 'textsceneGodotRole';

/**
 * Tags each node object under `root` with its name and role from `names`, by glTF node index. The
 * mesh, camera or light GLTFLoader puts under a bone stands for the node Godot names after the bone,
 * so it takes the bone's name. Requires `tagMeshInstances` first.
 */
export function tagGodotNodeNames(
  root: THREE.Object3D,
  associations: ReadonlyMap<unknown, GLTFReference>,
  names: readonly GltfNodeName[]
): void {
  root.traverse((object) => {
    const node = associations.get(object)?.nodes;
    const tag = node === undefined ? boneAttachmentName(object) : names[node];
    if (!tag) return;
    object.userData[GODOT_NAME_KEY] = tag.name;
    object.userData[GODOT_ROLE_KEY] = tag.role;
  });
}

/**
 * The node a bone's mesh, camera or light stands for, or undefined for any other object. Godot puts
 * it in the bone's BoneAttachment3D (`gltf_document.cpp:4625-4652`).
 */
function boneAttachmentName(object: THREE.Object3D): GltfNodeName | undefined {
  const parent = object.parent;
  if (!parent || !isBoneContent(object) || godotNodeRole(parent) !== 'bone') return undefined;
  return { name: godotNodeName(parent)!, role: 'node' };
}

function isBoneContent(object: THREE.Object3D): boolean {
  return isMeshInstance(object) || 'isCamera' in object || 'isLight' in object;
}

/** The name Godot gives the glTF node `object` stands for, or undefined for any other object. */
export function godotNodeName(object: THREE.Object3D): string | undefined {
  const name: unknown = object.userData[GODOT_NAME_KEY];
  return typeof name === 'string' ? name : undefined;
}

/** Where Godot puts the glTF node `object` stands for. Any other object is a `node`. */
export function godotNodeRole(object: THREE.Object3D): GltfNodeRole {
  const role: unknown = object.userData[GODOT_ROLE_KEY];
  return role === 'bone' || role === 'skinnedMesh' ? role : 'node';
}
