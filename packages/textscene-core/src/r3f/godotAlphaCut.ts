/**
 * `alpha_cut` → `BaseMaterial3D::Transparency` → three material state. Godot writes this switch
 * twice with identical arms (`sprite_3d.cpp:285-297`, `label_3d.cpp:386-393`), so it is one
 * decision here.
 */

/**
 * Divergence: Godot's prepass cut is 0.99 (`render_forward_clustered.cpp:1791`) and applies in the
 * depth pass only. three has one `alphaTest` for both passes, and 0.99 in the colour pass would
 * erase every antialiased edge, so 0.5 stands in until the passes get separate cuts.
 */
const PREPASS_ALPHA_TEST = 0.5;

/** The members `SpriteBase3D::AlphaCutMode` and `Label3D::AlphaCutMode` share; DISABLED is the `else`. */
const ALPHA_CUT_DISCARD = 1;
const ALPHA_CUT_OPAQUE_PREPASS = 2;
const ALPHA_CUT_HASH = 3;

/** Passed as `transparentFlag` by a node whose DrawFlags have no `FLAG_TRANSPARENT` member. */
export const NO_TRANSPARENT_FLAG = 'no-transparent-flag';

export interface AlphaCutInput {
  /** `SpriteBase3D::AlphaCutMode` or `Label3D::AlphaCutMode`: two C++ enums, same members. */
  mode: number;
  /** `alpha_scissor_threshold`; DISCARD is the only arm that reads it. */
  scissorThreshold: number;
  /**
   * The one difference between Godot's two copies. SpriteBase3D gates the switch on
   * `FLAG_TRANSPARENT` (`sprite_3d.h:43`). Label3D has no such DrawFlag (`label_3d.h:42-47`),
   * always enters it, and passes `NO_TRANSPARENT_FLAG`.
   */
  transparentFlag: boolean | typeof NO_TRANSPARENT_FLAG;
}

export interface AlphaCutSurface {
  alphaTest: number;
  alphaHash: boolean;
  depthWrite: boolean;
  /**
   * Whether the arm reaches the blended pass: a compile-time property of its shader, never of a
   * colour. `uses_alpha_pass()` (`scene_shader_forward_clustered.h:279-287`) reads the flag that
   * `ALPHA` sets (`material.cpp:1836`, `scene_shader_forward_clustered.cpp:123`), which classifies
   * the surface at `render_forward_clustered.cpp:4079-4090`.
   */
  blended: boolean;
}

/** Godot's `mat_transparency` switch in three's terms. */
export function alphaCutSurface({ mode, scissorThreshold, transparentFlag }: AlphaCutInput): AlphaCutSurface {
  // TRANSPARENCY_DISABLED is the initialiser the switch never reaches (`sprite_3d.cpp:284-286`).
  if (transparentFlag === false)
    return { alphaTest: 0, alphaHash: false, depthWrite: true, blended: false };
  // SCISSOR and HASH force `alpha = 1.0` past the cut (`scene_forward_clustered.glsl:1414-1416`),
  // so they land in the opaque list (`scene_shader_forward_clustered.cpp:252`), which writes depth.
  switch (mode) {
    case ALPHA_CUT_DISCARD:
      return { alphaTest: scissorThreshold, alphaHash: false, depthWrite: true, blended: false };
    case ALPHA_CUT_HASH:
      return { alphaTest: 0, alphaHash: true, depthWrite: true, blended: false };
    case ALPHA_CUT_OPAQUE_PREPASS:
      // The depth prepass keeps blending and cuts in the depth pass only.
      return { alphaTest: PREPASS_ALPHA_TEST, alphaHash: false, depthWrite: true, blended: true };
    default:
      // `depth_draw_opaque` on a blended surface writes no depth (`material.cpp:800`).
      return { alphaTest: 0, alphaHash: false, depthWrite: false, blended: true };
  }
}
