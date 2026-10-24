/**
 * Resolves a Godot node path on a loaded GLB by the whole path, as Godot's `get_node` does, through
 * the nodes the glTF importer builds (`godotNodes.ts`). A node lookup finds the object a Godot node
 * is, which a property write lands on. A target lookup also finds the object a Skeleton3D or
 * BoneAttachment3D stands in for, which a node attached below the path rides with.
 */

import type * as THREE from 'three';
import { flattenGlbObjects, type GlbObjectEntry } from './glbHierarchy.js';
import { godotFramePaths, godotNodePaths } from '../../../resources/formats/glb/godotNodes.js';
import { perObject } from '../../../utils/perObject.js';
import { warn } from '../../../logger.js';

interface PathTables {
  /** The entries by the paths of the Godot nodes their objects are. */
  nodes: ReadonlyMap<string, GlbObjectEntry>;
  /** The entries by the paths of the Skeleton3D and BoneAttachment3D nodes that follow them. */
  frames: ReadonlyMap<string, GlbObjectEntry>;
}

/** Built once for each entries list, which `flattenGlbObjects` builds once for each GLB. */
const pathTables = perObject((entries: readonly GlbObjectEntry[]): PathTables => {
  const nodes = new Map<string, GlbObjectEntry>();
  const frames = new Map<string, GlbObjectEntry>();
  for (const entry of entries) {
    for (const path of godotNodePaths(entry.object)) nodes.set(path, entry);
    for (const path of godotFramePaths(entry.object)) frames.set(path, entry);
  }
  return { nodes, frames };
});

/**
 * The GLB entry whose object is the Godot node at `godotPath`, or `null` when no node of the
 * imported scene has that path, or the node is one the object only stands in for. The scene tree
 * asks through this: the viewport already reports a path that matches nothing.
 *
 * @param entries the GLB flattened by `flattenGlbObjects`
 * @param godotPath the path relative to the GLB root, such as `Skeleton/Skeleton3D/Robot`
 */
export function findGlbNode(entries: readonly GlbObjectEntry[], godotPath: string): GlbObjectEntry | null {
  return pathTables(entries).nodes.get(godotPath) ?? null;
}

/** The paths `matchGlbNode` has warned about, so each consumer of one override leaves one warning. */
const warnedPaths = perObject((): Set<string> => new Set());

/** {@link findGlbNode}, with a warning when the path names nothing, the first time it is asked. */
export function matchGlbNode(entries: readonly GlbObjectEntry[], godotPath: string): GlbObjectEntry | null {
  const entry = findGlbNode(entries, godotPath);
  if (!entry && !warnedPaths(entries).has(godotPath)) {
    warnedPaths(entries).add(godotPath);
    warn(
      `[glbPathLookup] "${godotPath}" matches nothing in the loaded GLB: the override or node it carries is dropped`
    );
  }
  return entry;
}

/** {@link findGlbNode}, and the entries of the Skeleton3D and BoneAttachment3D nodes that follow an object. */
export function findGlbTarget(entries: readonly GlbObjectEntry[], godotPath: string): GlbObjectEntry | null {
  const { nodes, frames } = pathTables(entries);
  return nodes.get(godotPath) ?? frames.get(godotPath) ?? null;
}

/** The object that is the Godot node at `godotPath` inside the loaded GLB `root`, or `null`. */
export function findGlbObject(root: THREE.Object3D, godotPath: string): THREE.Object3D | null {
  return findGlbNode(flattenGlbObjects(root), godotPath)?.object ?? null;
}
