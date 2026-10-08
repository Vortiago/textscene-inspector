/**
 * The name Godot's importer gives each glTF node, on the object GLTFLoader builds for it. GLTFLoader
 * spells a name its own way (`Cube.001` becomes `Cube001`, a repeat `Cube_1`), so a scene's node
 * path into the glTF matches the Godot name. A tag in `userData`, which a clone copies, carries it.
 */

import type * as THREE from 'three';
import type { GLTFReference } from 'three/addons/loaders/GLTFLoader.js';

const GODOT_NAME_KEY = 'textsceneGodotName';

/** Tags each node object under `root` with its name from `names`, by glTF node index. A bone keeps none. */
export function tagGodotNodeNames(
  root: THREE.Object3D,
  associations: ReadonlyMap<unknown, GLTFReference>,
  names: readonly (string | null)[]
): void {
  root.traverse((object) => {
    const node = associations.get(object)?.nodes;
    const name = node === undefined ? null : names[node];
    if (name) object.userData[GODOT_NAME_KEY] = name;
  });
}

/** The name Godot gives the glTF node `object` stands for, or undefined for any other object. */
export function godotNodeName(object: THREE.Object3D): string | undefined {
  const name: unknown = object.userData[GODOT_NAME_KEY];
  return typeof name === 'string' ? name : undefined;
}
