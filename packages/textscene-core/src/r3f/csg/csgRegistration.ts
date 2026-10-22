/**
 * How a CSG slice exposes its solid as data: boolean evaluation needs triangles outside a `<mesh>`,
 * so the slice registers a builder beside its component on the render registry (ADR-0002). A
 * separate registry would let a slice register a component without a builder, which vanishes in a boolean.
 */

import type * as THREE from 'three';
import type { LoadedFile } from '../../resources/scopedResource';
import type { SceneResources } from '../SceneResourcesContext';
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
}

/**
 * `null` contributes nothing (an unresolved mesh, a degenerate polygon, equal torus radii). The
 * plan drops it rather than treat it as an empty solid, since intersecting with an empty solid
 * differs from intersecting with nothing.
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

/** A `CSGPrimitive3D`'s solid: one geometry under its one `material`. */
export function primitiveSolid(
  geometry: THREE.BufferGeometry,
  properties: { materialPath?: string }
): CsgSolid {
  return { geometry, materials: [properties.materialPath] };
}
