/**
 * The facing half of every flat 2D painter's material recipe: `THREE.DoubleSide`
 * and the single pass that travels with it, one spelling of both
 * (`canvasItemSinglePassConformance.test.ts`). Not for 3D: a double-sided
 * translucent `StandardMaterial3D` shell needs the two-pass split.
 */
import * as THREE from 'three';

/**
 * What a canvas item's material says about facing. `WebGLRenderer.renderObject`
 * draws a transparent `DoubleSide` material twice, back faces then front, unless
 * `forceSinglePass`. A flat item in painter's order has no facing, and a split
 * reorders mixed winding and double-counts an additive blend.
 */
export interface CanvasItemFacing {
  readonly side: THREE.Side;
  // `lineJoints.ts` joints wind by the sign of the turn and CPUParticles2D quads by
  // their transform: both paint one uniform colour, so their reorder does not show.
  // `ShadowVolumeMask.tsx`'s `ReplaceStencilOp` is idempotent. With neither mixed
  // winding nor an additive blend, one pass draws nothing, and the second is waste.
  readonly forceSinglePass: true;
}

/**
 * Spread onto JSX or a `new THREE.ShaderMaterial({ ...canvasItemFacing() })`
 * bag: `Material#setValues` assigns `forceSinglePass`. Godot's canvas culls nothing.
 * `Label3D` passes a one-sided `side` (`double_sided = false`), where one pass holds:
 * a coplanar quad array faces the camera one way as a whole.
 */
export function canvasItemFacing(side: THREE.Side = THREE.DoubleSide): CanvasItemFacing {
  // `scene/resources/style_box_flat.cpp` lines 403-408 give each ring quad two windings,
  // so each pass draws one triangle per quad and the shadow ring's second-pass half
  // lands over the border's first-pass half. Light quads add with `blendDst: OneFactor`
  // (`lighting2d/lightQuad.ts`), which two passes double-count.
  return { side, forceSinglePass: true };
}
