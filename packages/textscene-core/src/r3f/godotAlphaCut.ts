/**
 * `alpha_cut` → `BaseMaterial3D::Transparency` → three material state. Godot writes this switch
 * twice with identical arms (`sprite_3d.cpp:285-297`, `label_3d.cpp:386-393`), so it is one
 * decision here.
 */

import { drawsInShadowPass } from '../godot/shadowPass';
import type { SurfaceAlphaSource } from './materials/surfaceAlphaPatch';

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

export interface AlphaCutSurface extends SurfaceAlphaSource {
  alphaTest: number;
  alphaHash: boolean;
  depthWrite: boolean;
  /**
   * OPAQUE_PREPASS's `depth_prepass_alpha` (`material.cpp:898`): the depth prepass draws the
   * surface, and its depth draws cut at `opaque_prepass_threshold`.
   */
  depthPrepass: boolean;
  /**
   * Whether the arm reaches the blended pass: a compile-time property of its shader, never of a
   * colour. `uses_alpha_pass()` (`scene_shader_forward_clustered.h:279-287`) reads the flag that
   * `ALPHA` sets (`material.cpp:1836`, `scene_shader_forward_clustered.cpp:123`), which classifies
   * the surface at `render_forward_clustered.cpp:4079-4090`.
   */
  blended: boolean;
}

type CutArm = Omit<AlphaCutSurface, 'readsAlbedoAlpha'>;

/** The opaque pass with no cut, which every arm starts from. */
const OPAQUE_ARM: CutArm = {
  alphaTest: 0,
  alphaHash: false,
  depthPrepass: false,
  depthWrite: true,
  blended: false,
  opaqueAfterCut: false,
};

/** Godot's `mat_transparency` switch in three's terms. */
export function alphaCutSurface({ mode, scissorThreshold, transparentFlag }: AlphaCutInput): AlphaCutSurface {
  // TRANSPARENCY_DISABLED is the initialiser the switch never reaches (`sprite_3d.cpp:284-286`).
  // Its shader writes no ALPHA, so the texture alpha never reaches the blend.
  if (transparentFlag === false) {
    return { ...OPAQUE_ARM, readsAlbedoAlpha: false };
  }
  return { ...cutArm(mode, scissorThreshold), readsAlbedoAlpha: true };
}

/** One arm of the switch, each of which multiplies the albedo alpha into ALPHA. */
function cutArm(mode: number, scissorThreshold: number): CutArm {
  // SCISSOR and HASH force `alpha = 1.0` past the cut (`scene_forward_clustered.glsl:1413-1415`),
  // so they land in the opaque list (`scene_shader_forward_clustered.cpp:252`), which writes depth.
  switch (mode) {
    case ALPHA_CUT_DISCARD:
      return { ...OPAQUE_ARM, alphaTest: scissorThreshold, opaqueAfterCut: true };
    case ALPHA_CUT_HASH:
      return { ...OPAQUE_ARM, alphaHash: true, opaqueAfterCut: true };
    case ALPHA_CUT_OPAQUE_PREPASS:
      // Blended and uncut in colour. `get_material_for_2d` keeps DEPTH_DRAW_OPAQUE_ONLY, so only
      // the depth prepass writes depth.
      return { ...OPAQUE_ARM, depthPrepass: true, depthWrite: false, blended: true };
    default:
      // `depth_draw_opaque` on a blended surface writes no depth (`material.cpp:800`).
      return { ...OPAQUE_ARM, depthWrite: false, blended: true };
  }
}

/** Whether the surface joins the shadow pass. No depth test sends any surface to the alpha pass. */
export function joinsShadowPass(cut: AlphaCutSurface, depthTest: boolean): boolean {
  return drawsInShadowPass({
    alphaPass: cut.blended || !depthTest,
    depthInAlphaPass: cut.depthPrepass && depthTest,
  });
}
