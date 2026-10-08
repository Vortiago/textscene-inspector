/**
 * The node names Godot 4.6.3's glTF importer gives a file's nodes: `_assign_node_names`
 * (`gltf_document.cpp:3968-3996`), the bone names of `_create_skeletons` (`skin_tool.cpp:560-628`)
 * and the parse steps they depend on. A scene's node path into an instanced glTF names these, not
 * the names three's loader gives.
 */

import { isGltfJsonObject, type GltfJsonObject } from './gltf.js';
import { gltfSkeletonBones, type ImportNode } from './gltfSkeletons.js';
import { validateNodeName } from './nodeName.js';

/** The `.import` options that change the names. */
export interface GltfNamingOptions {
  /** `gltf/naming_version`: 0 for Godot 4.0 or 4.1, 1 for 4.2 to 4.4, 2 for 4.5 or later. */
  namingVersion: number;
  /** `nodes/import_as_skeleton_bones`. */
  importAsSkeletonBones: boolean;
  /** The file's name without its extension, which names an unnamed scene. */
  fileName: string;
}

/** `gltf/naming_version`'s default (`editor_scene_importer_gltf.cpp:87`). */
export const DEFAULT_GLTF_NAMING_VERSION = 2;

/**
 * Where the importer puts a node under a skeleton. A `bone` is a bone of its Skeleton3D, and a node
 * only when it holds a mesh, a camera or a light, which goes in a BoneAttachment3D of the bone's
 * name. A `skinnedMesh` goes straight under the Skeleton3D. A `node` under a bone goes in that
 * bone's BoneAttachment3D (`gltf_document.cpp:4612-4658,4777-4860`).
 */
export type GltfNodeRole = 'node' | 'bone' | 'skinnedMesh';

export interface GltfNodeName {
  /** The node name, or for a bone the name of the nodes its BoneAttachment3D holds. */
  name: string;
  role: GltfNodeRole;
}

/** Godot's `unique_names`, filled by `_gen_unique_name_static` (`gltf_document.cpp:7223-7242`). */
class UniqueNames {
  /** Grows only, through `take` and through the bone names before 4.5. */
  readonly used = new Set<string>();
  /** Each base's first number not yet tried. `used` only grows, so every number below it is taken. */
  private readonly nextIndex = new Map<string, number>();

  /** The validated name, numbered from 2 until it is unused. */
  take(name: string): string {
    const base = validateNodeName(name);
    let unique = base;
    let index = this.nextIndex.get(base) ?? 2;
    if (this.used.has(unique)) {
      for (unique = `${base}${index}`; this.used.has(unique); unique = `${base}${index}`) index++;
      this.nextIndex.set(base, index + 1);
    }
    this.used.add(unique);
    return unique;
  }
}

/** `_gen_unique_bone_name` (`skin_tool.cpp:792-812`): `_2` onwards, unlike a node name. */
function uniqueBoneName(used: Set<string>, name: string): string {
  const base = name.replace(/[:/]/g, '_') || 'bone';
  let unique = base;
  for (let index = 2; used.has(unique); index++) unique = `${base}_${index}`;
  used.add(unique);
  return unique;
}

/**
 * The bone names by node. Before 4.5 every bone is unique against the node names and every other
 * bone. From 4.5 a bone is unique against the node names and its own skeleton's bones.
 */
function boneNames(
  json: GltfJsonObject,
  skeletons: readonly (readonly number[])[],
  names: UniqueNames,
  namingVersion: number
): Map<number, string> {
  const nodes = objects(json['nodes']);
  const nodeNames = new Set(names.used);
  const byNode = new Map<number, string>();
  for (const bones of skeletons) {
    const used = namingVersion < 2 ? names.used : new Set(nodeNames);
    for (const bone of bones) byNode.set(bone, uniqueBoneName(used, text(nodes[bone]!['name'])));
  }
  return byNode;
}

function objects(value: unknown): GltfJsonObject[] {
  return Array.isArray(value) ? value.map((entry) => (isGltfJsonObject(entry) ? entry : {})) : [];
}

function indexes(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((entry): entry is number => Number.isInteger(entry)) : [];
}

function index(value: unknown): number {
  return Number.isInteger(value) ? (value as number) : -1;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** `_parse_nodes` (`gltf_document.cpp:563-652`): the graph with parents and heights. */
function importNodes(json: GltfJsonObject): ImportNode[] {
  const nodes = objects(json['nodes']);
  const parents = nodes.map(() => -1);
  nodes.forEach((node, i) => {
    for (const child of indexes(node['children'])) {
      // `ERR_CONTINUE` keeps a child's first parent.
      if (child < nodes.length && parents[child] === -1) parents[child] = i;
    }
  });
  const heights = new Map<number, number>();
  const heightOf = (node: number): number => {
    const parent = parents[node]!;
    if (parent < 0) return 0;
    const height = heights.get(node) ?? 1 + heightOf(parent);
    heights.set(node, height);
    return height;
  };
  return nodes.map((node, i) => ({
    children: indexes(node['children']).filter((child) => child < nodes.length),
    parent: parents[i]!,
    height: heightOf(i),
    mesh: index(node['mesh']),
    skin: index(node['skin']),
    joint: false,
  }));
}

/** `_parse_scenes` (`gltf_document.cpp:527-561`): the loaded scene's root nodes and its name. */
function loadedScene(json: GltfJsonObject, fileName: string): { roots: number[]; name: string } {
  const scenes = objects(json['scenes']);
  const scene = scenes[Number.isInteger(json['scene']) ? (json['scene'] as number) : 0];
  if (!scene) return { roots: [], name: '' };
  const name = text(scene['name']);
  return { roots: indexes(scene['nodes']), name: name !== '' && !name.startsWith('Scene') ? name : fileName };
}

/** The name `_assign_node_names` gives an unnamed node, by what it holds. */
function unnamedNodeName(node: GltfJsonObject, namingVersion: number): string {
  if (index(node['mesh']) >= 0) return 'Mesh';
  if (index(node['camera']) >= 0) return namingVersion === 0 ? 'Camera3D' : 'Camera';
  return 'Node';
}

/** Each node's name and role by glTF index. `json` is the parsed glTF document. A document with no `nodes` gives none. */
export function gltfNodeNames(json: unknown, options: GltfNamingOptions): GltfNodeName[] {
  if (!isGltfJsonObject(json)) return [];
  const { namingVersion, importAsSkeletonBones, fileName } = options;
  const names = new UniqueNames();
  // `_parse_scenes` reserves the name before it reads anything (`gltf_document.cpp:528`).
  names.take('Skeleton3D');
  const scene = loadedScene(json, fileName);
  if (namingVersion === 0 && objects(json['scenes']).length > 0) names.take(scene.name);

  const nodes = importNodes(json);
  // Before 4.5 the roots are every parentless node (`gltf_document.cpp:655-676`).
  const roots = namingVersion < 2 ? nodes.flatMap((node, i) => (node.parent < 0 ? [i] : [])) : scene.roots;
  const skinJoints = objects(json['skins']).map((skin) =>
    indexes(skin['joints']).filter((j) => j < nodes.length)
  );
  const skeletons = gltfSkeletonBones(
    nodes,
    skinJoints,
    importAsSkeletonBones ? roots : [],
    importAsSkeletonBones || namingVersion < 2
  );
  const bones = new Set(skeletons.flat());

  const sceneNames = objects(json['nodes']).map((node, i) => {
    if (bones.has(i)) return null;
    const name = text(node['name']);
    if (name !== '') return names.take(name);
    const unnamed = unnamedNodeName(node, namingVersion);
    return names.take(namingVersion === 0 ? names.take(unnamed) : unnamed);
  });
  const bonesByNode = boneNames(json, skeletons, names, namingVersion);

  return sceneNames.map((name, i): GltfNodeName => {
    if (name === null) return { name: validateNodeName(bonesByNode.get(i)!), role: 'bone' };
    const { mesh, skin } = nodes[i]!;
    return { name, role: mesh >= 0 && skin >= 0 ? 'skinnedMesh' : 'node' };
  });
}
