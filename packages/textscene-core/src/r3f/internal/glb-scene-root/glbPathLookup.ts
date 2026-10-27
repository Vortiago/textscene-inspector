/**
 * Resolves a Godot node path on a loaded GLB by the whole path, as Godot's `get_node` does, through
 * the nodes the glTF importer builds (`godotNodes.ts`). A node lookup finds the object a Godot node
 * is, which a property write lands on. A frame lookup finds a Skeleton3D or BoneAttachment3D, whose
 * properties `glbFrameOverrides` writes, and which a node attached below the path rides with.
 */

import type * as THREE from 'three';
import { flattenGlbObjects, type GlbObjectEntry } from './glbHierarchy.js';
import {
  godotFrames,
  godotNodePaths,
  frameGroupPath,
  type GodotFrameKind,
} from '../../../resources/formats/glb/godotNodes.js';
import { perObject } from '../../../utils/perObject.js';
import { warnOnce } from '../../../utils/warnOnce.js';

/** A Skeleton3D or BoneAttachment3D, which three has no object of its own for. */
export interface GlbFrame {
  path: string;
  kind: GodotFrameKind;
  /** The entry of the object it follows. */
  entry: GlbObjectEntry;
  /**
   * The group that holds what is below the node, or the object it follows when it holds nothing. A
   * node attached below the path is added to it.
   */
  host: THREE.Object3D;
}

interface PathTables {
  /** The entries by the paths of the Godot nodes their objects are. */
  nodes: ReadonlyMap<string, GlbObjectEntry>;
  frames: ReadonlyMap<string, GlbFrame>;
}

/** Built once for each entries list, which `flattenGlbObjects` builds once for each GLB. */
const pathTables = perObject((entries: readonly GlbObjectEntry[]): PathTables => {
  const nodes = new Map<string, GlbObjectEntry>();
  const frames = new Map<string, GlbFrame>();
  for (const entry of entries) {
    for (const path of godotNodePaths(entry.object)) nodes.set(path, entry);
    for (const { path, kind } of godotFrames(entry.object)) {
      frames.set(path, { path, kind, entry, host: frameHost(entry.object, path) });
    }
  }
  return { nodes, frames };
});

/** The group of the frame at `path` if `object` holds one, else `object`. */
function frameHost(object: THREE.Object3D, path: string): THREE.Object3D {
  return object.children.find((child) => frameGroupPath(child) === path) ?? object;
}

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

/** The Skeleton3D or BoneAttachment3D at `godotPath`, or `null` when the path names another node or none. */
export function findGlbFrame(entries: readonly GlbObjectEntry[], godotPath: string): GlbFrame | null {
  return pathTables(entries).frames.get(godotPath) ?? null;
}

/** Every Skeleton3D and BoneAttachment3D of the GLB. */
export function glbFrames(entries: readonly GlbObjectEntry[]): readonly GlbFrame[] {
  return [...pathTables(entries).frames.values()];
}

/**
 * {@link findGlbNode}, with a warning when the path names nothing, the first time it is asked. A
 * frame is something: `glbFrameOverrides` handles a write to it, so this returns null and stays quiet.
 */
export function matchGlbNode(entries: readonly GlbObjectEntry[], godotPath: string): GlbObjectEntry | null {
  const entry = findGlbNode(entries, godotPath);
  if (!entry && !findGlbFrame(entries, godotPath)) {
    warnOnce(
      entries,
      godotPath,
      `[glbPathLookup] "${godotPath}" matches nothing in the loaded GLB: the override or node it carries is dropped`
    );
  }
  return entry;
}

/** The entry of the node or frame at `godotPath`. A node attached below the path rides with it. */
export function findGlbTarget(entries: readonly GlbObjectEntry[], godotPath: string): GlbTarget | null {
  const entry = findGlbNode(entries, godotPath);
  if (entry) return { entry, host: entry.object };
  const frame = findGlbFrame(entries, godotPath);
  return frame && { entry: frame.entry, host: frame.host };
}

/** The entry a node attached below a path is placed by, and the object it is added to. */
export interface GlbTarget {
  entry: GlbObjectEntry;
  host: THREE.Object3D;
}

/**
 * The object that holds the properties of the Godot node at `godotPath` inside the loaded GLB
 * `root`, or `null`. For a Skeleton3D that is its group. A BoneAttachment3D has none: it takes the
 * pose of its bone (`bone_attachment_3d.cpp:311`), so no write to its transform lasts.
 */
export function findGlbObject(root: THREE.Object3D, godotPath: string): THREE.Object3D | null {
  const entries = flattenGlbObjects(root);
  const frame = findGlbFrame(entries, godotPath);
  if (frame) return frame.kind === 'skeleton' ? frame.host : null;
  return findGlbNode(entries, godotPath)?.object ?? null;
}
