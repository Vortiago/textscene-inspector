/**
 * How a CSG slice exposes its solid as data: boolean evaluation needs triangles outside a `<mesh>`,
 * so the slice registers a builder beside its component on the render registry (ADR-0002). A
 * separate registry would let a slice register a component without a builder, which vanishes in a boolean.
 */

import type * as THREE from 'three';
import type { LoadedFile } from '../../resources/scopedResource';
import type { SceneResources } from '../SceneResourcesContext';
import { isClosedBrush } from './brushManifold';
import type { CsgMaterialAddress } from './csgMaterials';

export interface CsgGeometryContext extends SceneResources {
  /**
   * Looks up the parse of a `.tres` the shape's `readsFiles` named: undefined while it loads or after it
   * failed.
   */
  loadedFile: LoadedFile;
}

/**
 * A CSG node's own solid, in its local space. With one material every face draws it. With more,
 * each draw group takes the material its `materialIndex` names, as a CSGMesh3D face takes its
 * surface's material (`csg_shape.cpp:1168-1172`).
 */
export interface CsgSolid {
  geometry: THREE.BufferGeometry;
  materials: readonly CsgMaterialAddress[];
  /**
   * Whether Godot's manifold keeps the brush. An open brush is empty: it draws nothing, bounds to
   * a point and empties the whole fold of its node (`csg_shape.cpp:431,977-988`).
   */
  isClosed: boolean;
}

/** A solid over a non-indexed `geometry`, three positions to a triangle, as `applyCsgNormals` emits. */
export function csgSolid(geometry: THREE.BufferGeometry, materials: readonly CsgMaterialAddress[]): CsgSolid {
  const positions = geometry.getAttribute('position').array as Float32Array;
  return { geometry, materials, isClosed: isClosedBrush(positions) };
}

/**
 * `null` is an empty brush (an unresolved mesh, a degenerate polygon, equal torus radii). It adds
 * nothing to a union, removes nothing in a subtraction and empties an intersection, as Godot's
 * empty manifold does.
 */
export type CsgGeometryBuilder = (
  properties: Record<string, unknown>,
  ctx: CsgGeometryContext
) => CsgSolid | null;

export interface CsgShapeRegistration {
  /**
   * `null` for a pure grouping node with no solid of its own. CSGCombiner3D is the only
   * one: its shape IS the boolean fold of its children.
   */
  geometry: CsgGeometryBuilder | null;
  /**
   * A stable string over what `geometry` reads, required whenever `geometry` is non-null: it keys
   * the evaluation cache, and the parser allocates fresh properties per reparse. It takes the
   * context of `geometry`, since a CSGMesh3D `mesh` reference stays the same while its sub-resource changes.
   */
  geometryKey?: (properties: Record<string, unknown>, ctx: CsgGeometryContext) => string;
  /**
   * The `.tres` paths `geometry` reads through `ctx.loadedFile`, which load before it can build. A path
   * that only a loaded file names is listed once `loadedFile` holds that file.
   */
  readsFiles?: (
    properties: Record<string, unknown>,
    pools: SceneResources,
    loadedFile: LoadedFile
  ) => readonly string[];
  /** The type of the mesh `geometry` reads, which the node's details name when no slice builds it. */
  meshType?: (properties: Record<string, unknown>, ctx: CsgGeometryContext) => string | null;
}

/**
 * A `CSGPrimitive3D`'s solid: one geometry under its one `material`. Box, sphere, cylinder and
 * torus builders emit a closed brush by construction, which `primitiveBrushes.test.ts` pins, so
 * this skips the weld that `csgSolid` runs.
 */
export function primitiveSolid(
  geometry: THREE.BufferGeometry,
  properties: { materialPath?: string }
): CsgSolid {
  return { geometry, materials: [properties.materialPath], isClosed: true };
}
