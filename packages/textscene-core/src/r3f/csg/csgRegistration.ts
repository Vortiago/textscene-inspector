/**
 * How a CSG slice exposes its solid as data: boolean evaluation needs triangles outside a `<mesh>`,
 * so the slice registers a builder beside its component on the render registry (ADR-0002). A
 * separate registry would let a slice register a component without a builder, which vanishes in a boolean.
 */

import type * as THREE from 'three';
import type { TscnInternalResource, TscnExternalResource } from '../../parser/types';

export interface CsgGeometryContext {
  internalResources: readonly TscnInternalResource[];
  externalResources: readonly TscnExternalResource[];
}

/**
 * A CSG node's own solid, in its local space. `null` contributes nothing (an unresolved mesh, a
 * degenerate polygon, equal torus radii). The plan drops it rather than treat it as an empty
 * solid, since intersecting with an empty solid differs from intersecting with nothing.
 */
export type CsgGeometryBuilder = (
  properties: Record<string, unknown>,
  ctx: CsgGeometryContext
) => THREE.BufferGeometry | null;

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
}
