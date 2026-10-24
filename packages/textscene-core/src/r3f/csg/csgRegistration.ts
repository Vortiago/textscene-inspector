/**
 * How a CSG slice exposes its solid as data: boolean evaluation needs triangles outside a `<mesh>`,
 * so the slice registers a builder beside its component on the render registry (ADR-0002). A
 * separate registry would let a slice register a component without a builder, which vanishes in a boolean.
 */

import type * as THREE from 'three';
import type { LoadedFile, LoadedFont } from '../../resources/scopedResource';
import type { SceneResources } from '../SceneResourcesContext';
import { isClosedBrush, type ShadedBrush } from './brushManifold';
import type { CsgMaterialAddress } from './csgMaterials';

export interface CsgGeometryContext extends SceneResources {
  /**
   * Looks up the parse of a `.tres` the shape's `readsFiles` named: undefined while it loads or after it
   * failed.
   */
  loadedFile: LoadedFile;
  /** Looks up a font file the shape's `readsFonts` named: undefined while it loads or after it failed. */
  loadedFont: LoadedFont;
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

/** The solid of a shaded brush, closed when its welded edges all run both ways. */
export function csgSolid(
  { geometry, welds }: ShadedBrush,
  materials: readonly CsgMaterialAddress[]
): CsgSolid {
  return { geometry, materials, isClosed: isClosedBrush(welds) };
}

/** Whether `solid` holds a face. A closed solid with none is Godot's empty brush. */
export function hasFaces(solid: CsgSolid): boolean {
  return (solid.geometry.getAttribute('position')?.count ?? 0) > 0;
}

/**
 * A shape's solid: a closed solid with no face (Godot's empty brush) for a shape that builds none,
 * or `null` for one not built yet, such as a mesh still loading or of a type no slice builds.
 * Either adds nothing to a union and empties an intersection, as Godot's empty manifold does.
 * Only the empty solid warns (`csg_shape.cpp:981`), since Godot draws a brush for the other.
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
  /** The font file paths `geometry` reads through `ctx.loadedFont`, which load before it can build. */
  readsFonts?: (properties: Record<string, unknown>, ctx: CsgGeometryContext) => readonly string[];
  /**
   * Whether a font `geometry` builds from awaits its metrics, which arrive after the font file
   * does. A root builds once no shape does.
   */
  awaitsFontMetrics?: (properties: Record<string, unknown>, ctx: CsgGeometryContext) => boolean;
  /**
   * The type of the mesh `geometry` reads while this previewer cannot draw it, which the node's
   * details name. Null for a mesh it draws, and for a shape with none.
   */
  undrawnMeshType?: (properties: Record<string, unknown>, ctx: CsgGeometryContext) => string | null;
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
