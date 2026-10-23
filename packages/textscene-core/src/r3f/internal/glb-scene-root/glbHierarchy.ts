/**
 * A loaded GLB as a display hierarchy for the scene tree, under the names Godot gives its nodes.
 * The walk is deterministic: children in order, duplicate sibling names suffixed `@<n>`. So the
 * tree's clone and the viewport's clone get the same relative paths, and a tree row lines up with
 * the rendered object.
 */

import type * as THREE from 'three';
import type { TscnNode } from '../../../parser/types.js';
import type { LiveNode } from '../../../resources/liveNode.js';
import { godotNodeName, godotNodeRole } from '../../../resources/formats/glb/nodeNames.js';
import type { GltfNodeRole } from '../../../godot/import/gltfImportNames.js';
import { insertAtIndex } from '../../../godot/scene/siblingIndex.js';
import { perObject } from '../../../utils/perObject.js';

/** Map a THREE.Object3D.type onto a Godot-ish display type. */
function glbDisplayType(threeType: string): string {
  if (threeType === 'Mesh' || threeType === 'SkinnedMesh' || threeType === 'InstancedMesh') {
    return 'Mesh';
  }
  if (threeType === 'Bone') return 'Bone';
  if (threeType === 'Group' || threeType === 'Object3D') return 'Node3D';
  if (threeType.endsWith('Camera')) return 'Camera3D';
  if (threeType.endsWith('Light')) return 'Light';
  return threeType;
}

/**
 * The name Godot's importer gives the glTF node `object` stands for. An object no node names, such
 * as a primitive or a bone, takes three's name, or its type when unnamed.
 */
export function glbObjectName(object: THREE.Object3D): string {
  return godotNodeName(object) ?? (object.name || object.type);
}

function segmentsForSiblings(children: readonly THREE.Object3D[]): string[] {
  const seen = new Map<string, number>();
  return children.map((child) => {
    const base = glbObjectName(child);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}@${n}`;
  });
}

/** A GLB object with its relPath. */
export interface GlbObjectEntry {
  /** Relative to the GLB root, unique and stable across structurally equal clones. */
  relPath: string;
  object: THREE.Object3D;
  /**
   * The relPath segments a Godot path to the object holds, in order. A bone is a node of Godot's
   * only as the BoneAttachment3D of a node it holds, so a bone segment stays only before such a node.
   */
  godotSegments: string[];
}

/**
 * The Godot segments of a child named `name` with `role`, from its parent's. The parent's bone
 * segment stays only before a node attached to it, and the child's own segment always stays.
 */
function childGodotSegments(parent: GlbObjectEntry | null, name: string, role: GltfNodeRole): string[] {
  if (!parent) return [name];
  const keepsParent = godotNodeRole(parent.object) !== 'bone' || role === 'node';
  return [...(keepsParent ? parent.godotSegments : parent.godotSegments.slice(0, -1)), name];
}

/**
 * Every object of the GLB below `root`, each before everything below it, so the viewport's objects
 * line up with the tree rows. Built once for each root, whose structure nothing changes once loaded.
 * The live tree and the GLB processor ask with the loader's template, so they share one walk. A
 * mounted GLB asks with its own clone, so its walk serves only that consumer. A write to it throws.
 */
export const flattenGlbObjects = perObject((root: THREE.Object3D): readonly GlbObjectEntry[] => {
  const out: GlbObjectEntry[] = [];
  const walk = (object: THREE.Object3D, parent: GlbObjectEntry | null, name: string): void => {
    const entry = {
      relPath: parent ? `${parent.relPath}/${name}` : name,
      object,
      godotSegments: childGodotSegments(parent, name, godotNodeRole(object)),
    };
    out.push(Object.freeze(entry));
    const childNames = segmentsForSiblings(object.children);
    object.children.forEach((child, i) => walk(child, entry, childNames[i]!));
  };
  const names = segmentsForSiblings(root.children);
  root.children.forEach((child, i) => walk(child, null, names[i]!));
  return Object.freeze(out);
});

/** A `GLB`-prefixed type, which counts as a supported display type. */
function glbInternalNodeType(displayType: string): string {
  switch (displayType) {
    case 'Mesh':
      return 'GLBMesh';
    case 'Bone':
      return 'GLBBone';
    case 'Camera3D':
      return 'GLBCamera';
    case 'Light':
      return 'GLBLight';
    default:
      return 'GLBNode';
  }
}

/**
 * Synthetic `TscnNode`s for the scene tree, one per entry of `root`, and each node by its relPath.
 * Each name is the disambiguated relPath segment, so `joinPath(parent, name)` reproduces `relPath`.
 */
function glbTreeNodes(root: THREE.Object3D): { topLevel: TscnNode[]; nodeAt: ReadonlyMap<string, TscnNode> } {
  const topLevel: TscnNode[] = [];
  // Each entry comes after its parent's, so the parent's node is built by the time a child needs it.
  const nodeAt = new Map<string, TscnNode>();
  for (const { relPath, object, godotSegments } of flattenGlbObjects(root)) {
    const name = godotSegments.at(-1)!;
    const displayType = glbDisplayType(object.type);
    const node: TscnNode = {
      // No file wrote a synthetic node, so it has no raw properties.
      rawProperties: {},
      name,
      type: glbInternalNodeType(displayType),
      children: [],
      properties: { glbDisplayType: displayType, glbRelPath: relPath } as Record<string, unknown>,
    };
    nodeAt.set(relPath, node);
    const parent = nodeAt.get(relPath.slice(0, -name.length - 1));
    (parent?.children ?? topLevel).push(node);
  }
  return { topLevel, nodeAt };
}

/**
 * Godot's glTF importer puts a model's clips on an `AnimationPlayer` child of the root, and so
 * does this tree. The type is `GLB`-prefixed so `rendersOwnVisual` reports it as drawing.
 */
export const GLB_ANIMATION_PLAYER_NAME = 'AnimationPlayer';
const GLB_ANIMATION_PLAYER_TYPE = 'GLBAnimationPlayer';

/**
 * Adds each of `attached` below the synthetic node whose `relPath` is its `glbTargetRelPath`, which
 * `splitAttachedChildren` sets.
 */
function addAttachedChildren(nodeAt: ReadonlyMap<string, TscnNode>, attached: readonly LiveNode[]): void {
  for (const child of attached) {
    const target = nodeAt.get(child.glbTargetRelPath!);
    if (target) insertAtIndex(target.children, child);
  }
}

/**
 * The children of a GLB with nothing attached, built once per GLB object. The live tree asks with
 * the loader's template, which every consumer shares, and asks again for each path it resolves.
 * Entries leave with their object.
 */
const plainChildren = perObject((root: THREE.Object3D) => freezeNodes(buildGlbSceneRootChildren(root, [])));

/** The shared answer is read by every consumer of the GLB, so a write to it throws. */
function freezeNodes(nodes: TscnNode[]): TscnNode[] {
  for (const node of nodes) {
    freezeNodes(node.children);
    Object.freeze(node);
  }
  return Object.freeze(nodes) as TscnNode[];
}

function buildGlbSceneRootChildren(root: THREE.Object3D, attached: readonly LiveNode[]): TscnNode[] {
  const { topLevel: nodes, nodeAt } = glbTreeNodes(root);
  addAttachedChildren(nodeAt, attached);
  const clips = root.animations;
  if (clips.length > 0) {
    nodes.push({
      rawProperties: {},
      name: GLB_ANIMATION_PLAYER_NAME,
      type: GLB_ANIMATION_PLAYER_TYPE,
      children: [],
      properties: {
        glbDisplayType: 'AnimationPlayer',
        glbRelPath: GLB_ANIMATION_PLAYER_NAME,
        glbClipNames: clips.map((c) => c.name),
      } as Record<string, unknown>,
    });
  }
  return nodes;
}

/**
 * How many children {@link glbSceneRootChildren} gives the root, with nothing attached, without
 * building them. Counted on the walk, not on `root.children`: a mounted clone gains a child for
 * each node R3F renders below it.
 */
export function glbSceneRootChildCount(root: THREE.Object3D): number {
  const topLevel = flattenGlbObjects(root).filter((entry) => entry.object.parent === root).length;
  return topLevel + (root.animations.length > 0 ? 1 : 0);
}

/**
 * A `GLBSceneRoot`'s tree children: the GLB hierarchy, with `attached` (as `splitAttachedChildren`
 * returns them) below the objects their parent paths name, plus an `AnimationPlayer` when it has
 * clips. `liveChildGroups` calls it, so the tree's rows, `resolveLiveEntry` and the viewport see
 * the same children.
 */
export function glbSceneRootChildren(root: THREE.Object3D, attached: readonly LiveNode[]): TscnNode[] {
  // Attaching writes into the nodes, so an attached list builds its own copy.
  return attached.length > 0 ? buildGlbSceneRootChildren(root, attached) : plainChildren(root);
}
