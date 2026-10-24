/**
 * The Godot nodes a loaded glTF stands for, tagged on the objects GLTFLoader builds for them: the
 * name and the node paths of Godot's importer. A scene's node path into the glTF names the Godot
 * node, which GLTFLoader spells otherwise or builds no object for. The tag sits in `userData`,
 * which a clone copies.
 */

import type * as THREE from 'three';
import type { GLTFReference } from 'three/addons/loaders/GLTFLoader.js';
import type { GltfImportNames } from '../../../godot/import/gltfImportNames';
import type { GltfSceneNode } from '../../../godot/import/gltfImportScene';
import { isMeshInstance } from './meshInstances';

const TAG_KEY = 'textsceneGodot';

/** Written only by `tagGodotNodes`. A path list is absent on an object that holds no path. */
interface GodotTag {
  name?: string;
  paths?: string[];
  framePaths?: string[];
  sceneRoot?: true;
}

const NO_PATHS: readonly string[] = Object.freeze([]);

type Associations = ReadonlyMap<unknown, GLTFReference>;

function tagOf(object: THREE.Object3D): GodotTag | undefined {
  return object.userData[TAG_KEY] as GodotTag | undefined;
}

/**
 * Tags `root`, the object Godot's importer makes the scene root, and each object under it with the
 * Godot name and node paths of the glTF node it stands for. Requires `tagMeshInstances` first.
 *
 * The mesh, camera or light GLTFLoader puts under a bone stands for the node Godot names after the
 * bone, so it takes the bone's name. Godot's own nodes with no object of GLTFLoader's answer to the
 * nearest object that moves with them: a BoneAttachment3D to its bone, and a Skeleton3D to the
 * object above its first bone.
 */
export function tagGodotNodes(
  root: THREE.Object3D,
  associations: Associations,
  { nodes, scene }: Pick<GltfImportNames, 'nodes' | 'scene'>
): void {
  const objectsByNode = new Map<number, THREE.Object3D>();
  root.traverse((object) => {
    const node = associations.get(object)?.nodes;
    if (node !== undefined) objectsByNode.set(node, object);
  });
  root.traverse((object) => {
    const node = associations.get(object)?.nodes;
    const name = node === undefined ? boneContentName(object, associations, nodes) : nodes[node]?.name;
    object.userData[TAG_KEY] = name === undefined ? {} : { name };
  });
  root.userData[TAG_KEY].sceneRoot = true;

  const objectOf = (godotNode: GltfSceneNode): THREE.Object3D | undefined => {
    const object = objectsByNode.get(godotNode.gltfNode);
    if (godotNode.kind === 'skeleton') return object?.parent ?? undefined;
    if (godotNode.kind === 'animationPlayer' || !object) return undefined;
    // A joint with a mesh holds it in a child object, which is the node Godot puts in the bone's BoneAttachment3D.
    return godotNode.kind === 'node' && nodes[godotNode.gltfNode]?.isBone
      ? (boneContent(object, associations) ?? object)
      : object;
  };
  for (const godotNode of scene) {
    const object = objectOf(godotNode);
    const tag = object && tagOf(object);
    if (!tag) continue;
    const list = godotNode.kind === 'node' ? (tag.paths ??= []) : (tag.framePaths ??= []);
    list.push(godotNode.path);
  }
}

/** The mesh, camera or light GLTFLoader puts below the bone object `bone`, if it holds one. */
function boneContent(bone: THREE.Object3D, associations: Associations): THREE.Object3D | undefined {
  return bone.children.find((child) => isBoneContent(child) && associations.get(child)?.nodes === undefined);
}

function isBoneContent(object: THREE.Object3D): boolean {
  return isMeshInstance(object) || 'isCamera' in object || 'isLight' in object;
}

/** The name of the node a bone's mesh, camera or light stands for: the bone's, as in the BoneAttachment3D. */
function boneContentName(
  object: THREE.Object3D,
  associations: Associations,
  nodes: GltfImportNames['nodes']
): string | undefined {
  const bone = nodes[associations.get(object.parent)?.nodes ?? -1];
  return bone?.isBone && isBoneContent(object) ? bone.name : undefined;
}

/** The name Godot gives the glTF node `object` stands for, or undefined for any other object. */
export function godotNodeName(object: THREE.Object3D): string | undefined {
  return tagOf(object)?.name;
}

/**
 * Every path below the GLB root of a Godot node that `object` is, in tree order. A skinned mesh
 * holds two when it has children, one for its Node3D and one below the Skeleton3D. A primitive of a
 * Group, and a bone no BoneAttachment3D follows, hold none, as does any object that is no part of
 * a loaded glTF.
 */
export function godotNodePaths(object: THREE.Object3D): readonly string[] {
  return tagOf(object)?.paths ?? NO_PATHS;
}

/**
 * Every path below the GLB root of a Godot node that `object` only stands in for: a Skeleton3D, which
 * three has no object for, and a BoneAttachment3D, which follows the bone. Such an object holds the
 * node's place in space, so a node attached below the path rides with it. It holds no property of
 * the node, so a write to the path has no object to land on.
 */
export function godotFramePaths(object: THREE.Object3D): readonly string[] {
  return tagOf(object)?.framePaths ?? NO_PATHS;
}

/** Whether `object` is the root of a loaded glTF, whose tags are its own and not an outer glTF's. */
export function isGodotSceneRoot(object: THREE.Object3D): boolean {
  return tagOf(object)?.sceneRoot === true;
}

/** Whether GLTFLoader built `object` for a loaded glTF, as opposed to a node of the scene that mounts it. */
export function isGlbObject(object: THREE.Object3D): boolean {
  return tagOf(object) !== undefined;
}
