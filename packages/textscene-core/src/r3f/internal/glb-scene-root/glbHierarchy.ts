/**
 * Walk a loaded GLB/GLTF THREE.Object3D into a display hierarchy for the scene
 * tree. The traversal is DETERMINISTIC (children in order, duplicate sibling
 * names disambiguated by an `@<n>` suffix) so the relative paths it produces are
 * identical across the two clones a GLB has at runtime — the tree's structural
 * clone (WI-C) and the viewport's rendered clone (WI-D). That lets a tree row's
 * path line up with the rendered object registered for selection/visibility.
 */

import type * as THREE from 'three';
import type { TscnNode } from '../../../parser/types.js';

export interface GlbHierarchyNode {
  /** Display name (THREE object's name, or its type when unnamed). */
  name: string;
  /** Path relative to the GLB root; unique + stable across structurally-equal clones. */
  relPath: string;
  /** Raw THREE.Object3D.type (Mesh, SkinnedMesh, Bone, Group, …). */
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

/** Build the GLB's internal hierarchy (the root itself is the GLB node; its CHILDREN are returned). */
export function buildGlbHierarchy(root: THREE.Object3D): GlbHierarchyNode[] {
  const segments = segmentsForSiblings(root.children);
  return root.children.map((child, i) => buildNode(child, '', segments[i]!));
}

/** One GLB-internal object paired with its relPath (same scheme as buildGlbHierarchy). */
export interface GlbObjectEntry {
  relPath: string;
  object: THREE.Object3D;
}

/**
 * Flatten a GLB root into `{ relPath, object }` entries using the SAME
 * deterministic path scheme as `buildGlbHierarchy`. The viewport's GLBSceneRoot
 * walks its rendered clone with this to register each object for selection and
 * to toggle per-object visibility — relPaths line up with the tree rows.
 */
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

/** Synthetic TSCN node type for a GLB-internal node (all `GLB*` → treated as a supported display type). */
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
 * Convert the GLB hierarchy into synthetic `TscnNode`s for the scene tree. The
 * node NAME is the disambiguated relPath segment so the tree's
 * `joinPath(parent, name)` reproduces `relPath` exactly — keeping tree rows in
 * lockstep with the objects WI-D registers for selection/visibility.
 */
export function glbHierarchyToTscnNodes(nodes: readonly GlbHierarchyNode[]): TscnNode[] {
  return nodes.map((n) => ({
    name: n.relPath.split('/').pop() ?? n.name,
    type: glbInternalNodeType(n.displayType),
    children: glbHierarchyToTscnNodes(n.children),
    properties: { glbDisplayType: n.displayType, glbRelPath: n.relPath } as Record<string, unknown>,
  }));
}
