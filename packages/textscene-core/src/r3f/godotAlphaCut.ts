/**
 * `alpha_cut` → `BaseMaterial3D::Transparency` → three material state.
 *
 * Godot writes this switch twice — `sprite_3d.cpp:285-297` and
 * `label_3d.cpp:386-393` — with identical arms, so it is one decision here.
 * ALPHA_SCISSOR and ALPHA_HASH force `alpha = 1.0` past the cut
 * (`scene_forward_clustered.glsl:1414-1416`) and so land in the opaque list
 * (`scene_shader_forward_clustered.cpp:252`), which writes depth;
 * ALPHA_DEPTH_PRE_PASS keeps blending and cuts in the depth pass only.
 *
 * The two copies differ in exactly one place, and `transparentFlag` is it:
 * SpriteBase3D gates the whole switch on `FLAG_TRANSPARENT` (`sprite_3d.h:43`),
 * Label3D has no such DrawFlag (`label_3d.h:42-47`) and always enters it.
 *
 * DIVERGENCE: Godot's prepass cut is 0.99 (`render_forward_clustered.cpp:1791`)
 * and applies in the DEPTH pass only; three has one `alphaTest` serving both
 * passes, so cutting the colour pass at 0.99 would erase every antialiased
 * edge. 0.5 is the stand-in until the two passes can be given separate cuts.
 */

/** Neither the material's own state nor a colour — a threshold the DEPTH pass would own. */
const PREPASS_ALPHA_TEST = 0.5;

/** The members `SpriteBase3D::AlphaCutMode` and `Label3D::AlphaCutMode` share; DISABLED is the `else`. */
const ALPHA_CUT_DISCARD = 1;
const ALPHA_CUT_OPAQUE_PREPASS = 2;
const ALPHA_CUT_HASH = 3;

/** Passed as `transparentFlag` by a node whose DrawFlags have no `FLAG_TRANSPARENT` member. */
export const NO_TRANSPARENT_FLAG = 'no-transparent-flag';

export interface AlphaCutInput {
  /** `SpriteBase3D::AlphaCutMode` / `Label3D::AlphaCutMode` — two C++ enums, same members. */
  mode: number;
  /** `alpha_scissor_threshold`; DISCARD is the only arm that reads it. */
  scissorThreshold: number;
  /** `FLAG_TRANSPARENT`, or `NO_TRANSPARENT_FLAG` for a node that has no such flag. */
  transparentFlag: boolean | typeof NO_TRANSPARENT_FLAG;
}

export interface AlphaCutSurface {
  alphaTest: number;
  alphaHash: boolean;
  depthWrite: boolean;
  /**
   * Whether the arm reaches the blended pass at all. A COMPILE-TIME property of
   * the arm's shader, never of a colour: `uses_alpha_pass()`
   * (`scene_shader_forward_clustered.h:279-287`) reads the `ALPHA`-written flag
   * (`material.cpp:1836`, `scene_shader_forward_clustered.cpp:123`) that
   * classifies the surface at `render_forward_clustered.cpp:4079-4090`.
   */
  blended: boolean;
}

/** Godot's `mat_transparency` switch in three's terms. */
export function alphaCutSurface({ mode, scissorThreshold, transparentFlag }: AlphaCutInput): AlphaCutSurface {
  // TRANSPARENCY_DISABLED is the initialiser the switch never reaches (`sprite_3d.cpp:284-286`).
  if (transparentFlag === false)
    return { alphaTest: 0, alphaHash: false, depthWrite: true, blended: false };
  switch (mode) {
    case ALPHA_CUT_DISCARD:
      return { alphaTest: scissorThreshold, alphaHash: false, depthWrite: true, blended: false };
    case ALPHA_CUT_HASH:
      return { alphaTest: 0, alphaHash: true, depthWrite: true, blended: false };
    case ALPHA_CUT_OPAQUE_PREPASS:
      return { alphaTest: PREPASS_ALPHA_TEST, alphaHash: false, depthWrite: true, blended: true };
    default:
      // `depth_draw_opaque` on a blended surface writes no depth (`material.cpp:800`).
      return { alphaTest: 0, alphaHash: false, depthWrite: false, blended: true };
  }
}
