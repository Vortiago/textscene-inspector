/**
 * How a CSG slice exposes its solid as DATA rather than as JSX.
 *
 * Boolean evaluation needs triangles outside a `<mesh>`, so each CSG slice registers a
 * builder alongside its component. This is a render-domain fact on the render-domain
 * registry, which is what ADR-0002 endorses: that ADR rejects a UNIFIED registry because
 * a `component` field would drag React into the linter bundle, not extra fields on a
 * registry the linter already never imports.
 *
 * A separate `csgGeometryRegistry` was considered and rejected for a specific reason: it
 * would let a slice register its component without its builder, and the failure mode
 * would be a node that renders alone but silently vanishes inside a boolean.
 */

import type * as THREE from 'three';
import type { TscnInternalResource, TscnExternalResource } from '../../parser/types';

export interface CsgGeometryContext {
  internalResources: readonly TscnInternalResource[];
  externalResources: readonly TscnExternalResource[];
}

/**
 * A CSG node's own solid, in its OWN local space with no node transform applied.
 *
 * `null` means "contributes nothing right now": an unresolved mesh reference, a
 * degenerate polygon, equal torus radii. The plan drops such a contribution rather than
 * treating it as an empty solid, because subtracting nothing and subtracting an empty
 * solid are the same thing but intersecting with one is not.
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
   * A stable string over exactly the properties `geometry` reads. REQUIRED whenever
   * `geometry` is non-null.
   *
   * Not optional, because it is the evaluation cache's key. The parser allocates a fresh
   * properties object per reparse and the source pane reparses on every keystroke, so an
   * identity-keyed cache would miss every time and re-run the whole boolean tree per
   * character typed. `meshGeometry.tsx` already documents the same trap one level down.
   */
  geometryKey?: (properties: Record<string, unknown>) => string;
}
