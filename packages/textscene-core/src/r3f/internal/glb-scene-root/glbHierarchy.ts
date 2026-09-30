/**
 * A loaded GLB as a display hierarchy for the scene tree. The walk is deterministic: children in
 * order, duplicate sibling names suffixed `@<n>`. So the tree's clone and the viewport's clone get
 * the same relative paths, and a tree row lines up with the rendered object.
 */

import type * as THREE from 'three';
import type { TscnNode } from '../../../parser/types.js';

export interface GlbHierarchyNode {
  /** Display name (THREE object's name, or its type when unnamed). */
  name: string;
  /** Relative to the GLB root, unique and stable across structurally equal clones. */
  relPath: string;
  /** THREE.Object3D.type: Mesh, SkinnedMesh, Bone, Group, … */
  threeType: string;
  /** TSCN-ish display type for the tree/inspector. */
  displayType: string;
  children: GlbHierarchyNode[];
}

/** Map a THREE.Object3D.type onto a Godot-ish display type. */
export function glbDisplayType(threeType: string): string {
  if (threeType === 'Mesh' || threeType === 'SkinnedMesh' || threeType === 'InstancedMesh') {
    return 'Mesh';
  }
  if (threeType === 'Bone') return 'Bone';
  if (threeType === 'Group' || threeType === 'Object3D') return 'Node3D';
  if (threeType.endsWith('Camera')) return 'Camera3D';
  if (threeType.endsWith('Light')) return 'Light';
  return threeType;
}

function segmentsForSiblings(children: readonly THREE.Object3D[]): string[] {
  const seen = new Map<string, number>();
  return children.map((child) => {
    const base = child.name || child.type;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}@${n}`;
  });
}

function buildNode(object: THREE.Object3D, parentPath: string, segment: string): GlbHierarchyNode {
  const relPath = parentPath ? `${parentPath}/${segment}` : segment;
  const childSegments = segmentsForSiblings(object.children);
  return {
    name: object.name || object.type,
    relPath,
    threeType: object.type,
    displayType: glbDisplayType(object.type),
    children: object.children.map((child, i) => buildNode(child, relPath, childSegments[i]!)),
  };
}

/** Returns the root's children: the root itself is the GLB node. */
export function buildGlbHierarchy(root: THREE.Object3D): GlbHierarchyNode[] {
  const segments = segmentsForSiblings(root.children);
  return root.children.map((child, i) => buildNode(child, '', segments[i]!));
}

/** A GLB object with its relPath, in `buildGlbHierarchy`'s scheme. */
export interface GlbObjectEntry {
  relPath: string;
  object: THREE.Object3D;
}

/** `buildGlbHierarchy`'s path scheme, flat, so the viewport's objects line up with the tree rows. */
export function flattenGlbObjects(root: THREE.Object3D): GlbObjectEntry[] {
  const out: GlbObjectEntry[] = [];
  const walk = (object: THREE.Object3D, parentPath: string, segment: string): void => {
    const relPath = parentPath ? `${parentPath}/${segment}` : segment;
    out.push({ relPath, object });
    const childSegments = segmentsForSiblings(object.children);
    object.children.forEach((child, i) => walk(child, relPath, childSegments[i]!));
  };
  const segments = segmentsForSiblings(root.children);
  root.children.forEach((child, i) => walk(child, '', segments[i]!));
  return out;
}

/** A `GLB`-prefixed type, which counts as a supported display type. */
export function glbInternalNodeType(displayType: string): string {
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
 * Synthetic `TscnNode`s for the scene tree. Each name is the disambiguated relPath segment, so
 * `joinPath(parent, name)` reproduces `relPath` exactly.
 */
export function glbHierarchyToTscnNodes(nodes: readonly GlbHierarchyNode[]): TscnNode[] {
  return nodes.map((n) => ({
    name: n.relPath.split('/').pop() ?? n.name,
    type: glbInternalNodeType(n.displayType),
    children: glbHierarchyToTscnNodes(n.children),
    properties: { glbDisplayType: n.displayType, glbRelPath: n.relPath } as Record<string, unknown>,
  }));
}

/**
 * Godot's glTF importer puts a model's clips on an `AnimationPlayer` child of the root, and so
 * does this tree. The type is `GLB`-prefixed so `rendersOwnVisual` reports it as drawing.
 */
export const GLB_ANIMATION_PLAYER_NAME = 'AnimationPlayer';
export const GLB_ANIMATION_PLAYER_TYPE = 'GLBAnimationPlayer';

/**
 * A `GLBSceneRoot`'s tree children: the GLB hierarchy, plus an `AnimationPlayer` when it has clips.
 * One source, so `useGlbChildren` and `resolveLiveNode` produce the same children.
 */
export function glbSceneRootChildren(root: THREE.Object3D): TscnNode[] {
  const nodes = glbHierarchyToTscnNodes(buildGlbHierarchy(root));
  const clips = root.animations;
  if (clips.length > 0) {
    nodes.push({
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
