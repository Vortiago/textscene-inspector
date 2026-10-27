/**
 * The Godot nodes a loaded glTF stands for, tagged on the objects GLTFLoader builds for them: the
 * name and the node paths of Godot's importer. A scene's node path into the glTF names the Godot
 * node, which GLTFLoader spells otherwise or builds no object for. The tag sits in `userData`,
 * which a clone copies.
 */

import * as THREE from 'three';
import type { GLTFReference } from 'three/addons/loaders/GLTFLoader.js';
import type { GltfImportNames } from '../../../godot/import/gltfImportNames';
import type { GltfSceneNode } from '../../../godot/import/gltfImportScene';
import { parentPathOf } from '../../../utils/nodePath';
import { isMeshInstance } from './meshInstances';

const TAG_KEY = 'textsceneGodot';

export type GodotFrameKind = 'skeleton' | 'boneAttachment';

/** A node the importer adds that three has no object of its own for. */
export interface GodotFrame {
  path: string;
  kind: GodotFrameKind;
}

/** Written by `tagGodotNodes` and `markFrameGroup`. A list is absent on an object that holds none. */
interface GodotTag {
  name?: string;
  paths?: string[];
  frames?: GodotFrame[];
  /** The path of the Skeleton3D the object is a bone of. */
  skeleton?: string;
  /** The path of the Skeleton3D or BoneAttachment3D the object holds the children of. */
  frameGroup?: string;
  /** The `Matrix4` elements of the object's glTF transform, where Godot makes the node a bone. */
  rest?: number[];
  /** Set on a skinned mesh that Godot moves below its Skeleton3D. */
  underSkeleton?: true;
  sceneRoot?: true;
}

const NO_PATHS: readonly string[] = Object.freeze([]);
const NO_FRAMES: readonly GodotFrame[] = Object.freeze([]);

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
  const skeletonPaths = new Set(scene.filter((node) => node.kind === 'skeleton').map((node) => node.path));
  for (const godotNode of scene) {
    const object = objectOf(godotNode);
    const tag = object && tagOf(object);
    if (!tag) continue;
    if (godotNode.kind === 'node') (tag.paths ??= []).push(godotNode.path);
    else if (godotNode.kind !== 'animationPlayer') {
      (tag.frames ??= []).push({ path: godotNode.path, kind: godotNode.kind });
    }
    if (godotNode.kind === 'skeleton') tagBones(godotNode.bones ?? [], godotNode.path, objectsByNode);
    if (object instanceof THREE.SkinnedMesh && skeletonPaths.has(parentPathOf(godotNode.path) ?? '')) {
      tag.underSkeleton = true;
    }
    if (
      godotNode.kind === 'node' &&
      nodes[godotNode.gltfNode]?.isBone &&
      objectsByNode.get(godotNode.gltfNode) === object
    ) {
      tag.rest = localMatrix(object).elements;
    }
  }
}

function tagBones(
  bones: readonly number[],
  skeletonPath: string,
  objectsByNode: ReadonlyMap<number, THREE.Object3D>
): void {
  for (const bone of bones) {
    const object = objectsByNode.get(bone);
    const tag = object && tagOf(object);
    if (tag) tag.skeleton = skeletonPath;
  }
}

function localMatrix(object: THREE.Object3D): THREE.Matrix4 {
  return new THREE.Matrix4().compose(object.position, object.quaternion, object.scale);
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
 * Every Skeleton3D and BoneAttachment3D that `object` stands in for, which three has no object for:
 * a Skeleton3D stands in for the object above its first bone, and a BoneAttachment3D follows its
 * bone. Such an object holds the node's place in space, so a node attached below the path rides
 * with it. It holds no property of the node.
 */
export function godotFrames(object: THREE.Object3D): readonly GodotFrame[] {
  return tagOf(object)?.frames ?? NO_FRAMES;
}

/** The path of the Skeleton3D that `object` is a bone of, or undefined for any other object. */
export function godotSkeletonOfBone(object: THREE.Object3D): string | undefined {
  return tagOf(object)?.skeleton;
}

/** Makes `group` the object of the Skeleton3D or BoneAttachment3D at `framePath`, which holds its children. */
export function markFrameGroup(group: THREE.Object3D, framePath: string): void {
  group.userData[TAG_KEY] = { frameGroup: framePath } satisfies GodotTag;
}

/** The path of the Skeleton3D or BoneAttachment3D that `object` is the group of, or undefined. */
export function frameGroupPath(object: THREE.Object3D): string | undefined {
  return tagOf(object)?.frameGroup;
}

/**
 * The rest pose of the bone Godot makes of the node `object` is, as the glTF transform `object`
 * carried when it loaded. Godot gives such a node an identity transform below the BoneAttachment3D
 * (`gltf_document.cpp:4646-4648` sets the transform of a non-joint only), so a transform written to
 * the node composes onto this pose. Undefined for a node that keeps its own transform.
 */
export function godotBoneRest(object: THREE.Object3D): THREE.Matrix4 | undefined {
  const rest = tagOf(object)?.rest;
  return rest && new THREE.Matrix4().fromArray(rest);
}

/** Whether `object` is a skinned mesh that Godot moves below its Skeleton3D. */
export function isUnderGodotSkeleton(object: THREE.Object3D): object is THREE.SkinnedMesh {
  return tagOf(object)?.underSkeleton === true;
}

/** Whether `object` is the root of a loaded glTF, whose tags are its own and not an outer glTF's. */
export function isGodotSceneRoot(object: THREE.Object3D): boolean {
  return tagOf(object)?.sceneRoot === true;
}

/** Whether GLTFLoader built `object` for a loaded glTF, as opposed to a node of the scene that mounts it. */
export function isGlbObject(object: THREE.Object3D): boolean {
  return tagOf(object) !== undefined;
}
