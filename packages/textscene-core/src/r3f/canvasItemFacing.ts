/**
 * `canvasItemFacing()` — the facing half of the material recipe every flat 2D
 * canvas painter uses, defined once: `THREE.DoubleSide` and the SINGLE PASS
 * that has to travel with it.
 *
 * `WebGLRenderer.renderObject` draws a material TWICE — once culled to
 * `BackSide`, then once to `FrontSide` — whenever
 * `material.transparent === true && material.side === DoubleSide &&
 * material.forceSinglePass === false`, so a translucent 3D shell shows its far
 * surface before its near one. A canvas item is not a shell: it is a flat,
 * coplanar triangle array drawn in PAINTER'S order, and facing is not a
 * property it has. Splitting it by facing goes wrong in three different ways
 * depending on what the array holds, and only the third is harmless:
 *
 *   MIXED WINDING splits ONE item across the two passes and reorders it.
 *   `StyleBoxFlat::draw`'s ring pattern (`scene/resources/style_box_flat.cpp:
 *   403-408`, `(i, i+2, i+1)` over alternating inner/outer vertices) gives the
 *   two triangles of every ring quad opposite screen-space winding, so each
 *   pass kept one triangle per quad and dropped the other — the border lost a
 *   wedge per corner-detail step, and the shadow ring's second-pass half landed
 *   ON TOP of the border's first-pass half. `Line2D`'s joint wedges have the
 *   same property for an unrelated reason (`lineJoints.ts` picks the outward
 *   normal from the SIGN of the turn, so a left corner and a right corner wind
 *   opposite ways while the segment quads between them do not), and a
 *   `CPUParticles2D` quad inherits the determinant of its own particle
 *   transform. Those two paint one uniform colour today, which is the only
 *   reason the reorder does not show.
 *
 *   AN ACCUMULATING BLEND double-counts wherever both passes cover a fragment.
 *   The 2D light quads sum into the accumulator with `blendDst: OneFactor`
 *   (`lighting2d/lightQuad.ts`), and a stencil op that was not idempotent would
 *   stamp twice (`lighting2d/ShadowVolumeMask.tsx` uses `ReplaceStencilOp`,
 *   which is).
 *
 *   Otherwise one of the two passes draws nothing at all, and the doubled draw
 *   call is pure waste.
 *
 * Hence single pass is the DEFAULT rather than a flag each painter is trusted
 * to remember: `forceSinglePass` cannot be spelled apart from the `DoubleSide`
 * that makes it necessary. `canvasItemSinglePassConformance.test.ts` keeps the
 * 2D render tree from growing a hand-written second copy of the recipe.
 *
 * Deliberately NOT 3D. A genuinely double-sided translucent shell — a mesh
 * whose `StandardMaterial3D` disables culling — is exactly what the two-pass
 * split exists for, and nothing here reaches those materials.
 */
import * as THREE from 'three';

/** What a canvas item's material says about facing. Nothing else. */
export interface CanvasItemFacing {
  readonly side: THREE.Side;
  readonly forceSinglePass: true;
}

/**
 * Spread onto any material a canvas item paints with — JSX
 * (`<meshBasicMaterial {...canvasItemFacing()} />`) and a constructor options
 * bag (`new THREE.ShaderMaterial({ ...canvasItemFacing() })`) alike.
 * `forceSinglePass` is a property `THREE.Material`'s own constructor declares,
 * so `Material#setValues` assigns it rather than warning and dropping it the
 * way it drops `defines` on a non-shader material.
 *
 * `side` defaults to `THREE.DoubleSide` — Godot's 2D canvas culls nothing — and
 * is overridable for the one painter a 3D node also drives: `Label3D` turns its
 * glyph quads one-sided (`double_sided = false`) through the shared `TextRun`.
 * Single pass still holds there. A coplanar quad array faces the camera one way
 * or the other as a whole, so exactly ONE of the two passes ever produces a
 * fragment for it; the pass the split loses was drawing nothing.
 */
export function canvasItemFacing(side: THREE.Side = THREE.DoubleSide): CanvasItemFacing {
  return { side, forceSinglePass: true };
}
