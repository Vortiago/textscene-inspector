/**
 * The node names Godot 4.6.3's glTF importer gives a file's nodes: `_assign_node_names`
 * (`gltf_document.cpp:3968-3996`) with the parse steps it depends on. A scene's node path into an
 * instanced glTF names these, not the names three's loader gives.
 */

import { gltfBoneNodes, type ImportNode } from './gltfSkeletons.js';
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

/** Godot's `unique_names`, filled by `_gen_unique_name_static` (`gltf_document.cpp:7223-7242`). */
class UniqueNames {
  private readonly used = new Set<string>();

  /** The validated name, numbered from 2 until it is unused. */
  take(name: string): string {
    const base = validateNodeName(name);
    let unique = base;
    for (let index = 2; this.used.has(unique); index++) unique = `${base}${index}`;
    this.used.add(unique);
    return unique;
  }
}

type JsonObject = Readonly<Record<string, unknown>>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.map((entry) => (isObject(entry) ? entry : {})) : [];
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
function importNodes(json: JsonObject): ImportNode[] {
  const nodes = objects(json['nodes']);
  const parents = nodes.map(() => -1);
  nodes.forEach((node, i) => {
    for (const child of indexes(node['children'])) {
      // `ERR_CONTINUE` keeps a child's first parent.
      if (child < nodes.length && parents[child] === -1) parents[child] = i;
    }
  });
  const heightOf = (node: number): number => (parents[node]! < 0 ? 0 : 1 + heightOf(parents[node]!));
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
function loadedScene(json: JsonObject, fileName: string): { roots: number[]; name: string } {
  const scenes = objects(json['scenes']);
  const scene = scenes[Number.isInteger(json['scene']) ? (json['scene'] as number) : 0];
  if (!scene) return { roots: [], name: '' };
  const name = text(scene['name']);
  return { roots: indexes(scene['nodes']), name: name !== '' && !name.startsWith('Scene') ? name : fileName };
}

/** The name `_assign_node_names` gives an unnamed node, by what it holds. */
function unnamedNodeName(node: JsonObject, namingVersion: number): string {
  if (index(node['mesh']) >= 0) return 'Mesh';
  if (index(node['camera']) >= 0) return namingVersion === 0 ? 'Camera3D' : 'Camera';
  return 'Node';
}

/**
 * Each node's name by glTF index, or null for a node the importer makes a bone. `json` is the
 * parsed glTF document. A document with no `nodes` gives none.
 */
export function gltfNodeNames(json: unknown, options: GltfNamingOptions): (string | null)[] {
  if (!isObject(json)) return [];
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
  const bones = gltfBoneNodes(
    nodes,
    skinJoints,
    importAsSkeletonBones ? roots : [],
    importAsSkeletonBones || namingVersion < 2
  );

  return objects(json['nodes']).map((node, i) => {
    if (bones.has(i)) return null;
    const name = text(node['name']);
    if (name !== '') return names.take(name);
    const unnamed = unnamedNodeName(node, namingVersion);
    return names.take(namingVersion === 0 ? names.take(unnamed) : unnamed);
  });
}
