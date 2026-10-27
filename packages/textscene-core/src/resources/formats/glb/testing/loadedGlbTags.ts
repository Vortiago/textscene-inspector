/**
 * Tags a hand-built THREE graph as a loaded glTF, through the code `createGLBMesh` runs: the glTF
 * document the graph stands for goes to `gltfImportNames`, and `tagGodotNodes` tags the objects.
 * Each descendant of the root is a glTF node, in tree order. A `Bone` is a joint, a `SkinnedMesh`
 * holds the skin, and any other `Mesh` holds a mesh. A listed primitive is a surface of its parent's
 * mesh, as GLTFLoader builds a mesh of several primitives, and no node.
 */

import * as THREE from 'three';
import type { GLTFReference } from 'three/addons/loaders/GLTFLoader.js';
import { DEFAULT_GLTF_NAMING_VERSION, gltfImportNames } from '../../../../godot/import/gltfImportNames';
import { tagGodotNodes } from '../godotNodes';
import { tagMeshInstances } from '../meshInstances';

export interface LoadedGlbOptions {
  /** The glTF name of an object by its THREE name, where the loader spells it otherwise. */
  gltfNames?: Readonly<Record<string, string>>;
  namingVersion?: number;
  importAsSkeletonBones?: boolean;
  /** The Meshes that are primitives of the Group above them. */
  primitives?: readonly THREE.Object3D[];
}

export function tagAsLoadedGlb(
  root: THREE.Object3D,
  {
    gltfNames = {},
    namingVersion = DEFAULT_GLTF_NAMING_VERSION,
    importAsSkeletonBones = false,
    primitives = [],
  }: LoadedGlbOptions = {}
): void {
  const objects: THREE.Object3D[] = [];
  root.children.forEach(function collect(object) {
    if (primitives.includes(object)) return;
    objects.push(object);
    object.children.forEach(collect);
  });
  const indexOf = new Map(objects.map((object, index) => [object, index]));
  const nodes = objects.map((object) => ({
    name: gltfNames[object.name] ?? object.name,
    children: object.children.flatMap((child) => indexOf.get(child) ?? []),
    ...(holdsMesh(object, primitives) ? { mesh: 0 } : {}),
    ...(object instanceof THREE.SkinnedMesh ? { skin: 0 } : {}),
  }));
  const joints = objects.flatMap((object, index) => (object instanceof THREE.Bone ? [index] : []));
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: root.children.map((child) => indexOf.get(child)!) }],
    nodes,
    meshes: [{ primitives: [] }],
    ...(joints.length > 0 ? { skins: [{ joints }] } : {}),
  };
  const associations = new Map<unknown, GLTFReference>([
    ...objects.map((object, index): [THREE.Object3D, GLTFReference] => [
      object,
      holdsMesh(object, primitives) ? { nodes: index, meshes: 0 } : { nodes: index },
    ]),
    ...primitives.map((object, index): [THREE.Object3D, GLTFReference] => [
      object,
      { meshes: 0, primitives: index },
    ]),
  ]);
  const names = gltfImportNames(json, { namingVersion, importAsSkeletonBones, fileName: '' });
  tagMeshInstances(root, associations);
  tagGodotNodes(root, associations, names);
}

function holdsMesh(object: THREE.Object3D, primitives: readonly THREE.Object3D[]): boolean {
  return object instanceof THREE.Mesh || object.children.some((child) => primitives.includes(child));
}
