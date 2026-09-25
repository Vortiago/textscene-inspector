/**
 * Apply an **Import sidecar**'s root scale to a freshly loaded source asset (ADR-0028),
 * which Godot's importer bakes. It runs once per asset in the resource processor, so
 * every reader (render, bounds, selection, the scene tree) sees one corrected object.
 */

import type * as THREE from 'three';
import type { RootScale } from './types';

/**
 * `bake` mirrors Godot's `nodes/apply_root_scale`. True scales the asset's own content
 * and leaves the root at 1, so a node a `.tscn` parents to the instanced root, such as
 * a collision shape authored against the final size, is not scaled.
 */
export function applyRootScale(root: THREE.Object3D, rootScale: RootScale | null): void {
  if (!rootScale) return;
  const { scale, bake } = rootScale;

  // False scales the root, which carries to those later children, as in Godot.
  if (!bake) {
    root.scale.multiplyScalar(scale);
    return;
  }

  // Scaling each direct child's local transform scales the whole subtree, offsets as
  // well as sizes, so a multi-part asset shrinks as one piece. Godot also scales
  // animation position tracks when it bakes, and this does not, so animated positions
  // play at the unscaled amplitude.
  for (const child of root.children) {
    child.position.multiplyScalar(scale);
    child.scale.multiplyScalar(scale);
  }
}
