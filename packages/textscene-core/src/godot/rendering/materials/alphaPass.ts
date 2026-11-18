import type { EnumValue } from '../../classdb/enumNames';
import type { PassMembership } from '../shadowPass';
import { turnsOnAlphaToCoverage, type AlphaAntiAliasing } from './alphaAntialiasing';
import { BlendMode } from './blendMode';
import { DepthDrawMode } from './depthDrawMode';

/** What `uses_alpha_pass()` and `uses_depth_in_alpha_pass()` read of a 3D shader, in Godot's names. */
export interface ShaderPassFlags {
  readonly usesAlpha: boolean;
  readonly usesAlphaClip: boolean;
  readonly usesAlphaAntialiasing: boolean;
  readonly usesDepthPrepassAlpha: boolean;
  /** `uses_screen_texture || uses_depth_texture || uses_normal_texture`. */
  readonly hasReadScreenAlpha: boolean;
  readonly usesBlendAlpha: boolean;
  readonly depthDrawMode: EnumValue<typeof DepthDrawMode>;
  /** `depth_test == DEPTH_TEST_ENABLED`: neither disabled nor inverted. */
  readonly isDepthTestEnabled: boolean;
}

/** `uses_alpha_pass()` and `uses_depth_in_alpha_pass()` (`scene_shader_forward_clustered.h:279-293`). */
export function passMembership(flags: ShaderPassFlags): PassMembership {
  const hasBaseAlpha =
    (flags.usesAlpha && (!flags.usesAlphaClip || flags.usesAlphaAntialiasing)) || flags.hasReadScreenAlpha;
  const hasAlpha = hasBaseAlpha || flags.usesBlendAlpha;
  const noDepthDraw = flags.depthDrawMode === DepthDrawMode.DISABLED;
  const noDepthTest = !flags.isDepthTestEnabled;
  return {
    alphaPass: hasAlpha || flags.hasReadScreenAlpha || noDepthDraw || noDepthTest,
    depthInAlphaPass:
      (flags.usesDepthPrepassAlpha || flags.usesAlphaAntialiasing) && !(noDepthDraw || noDepthTest),
  };
}

/** `uses_blend_alpha` (`material_storage.cpp:718`), after `scene_shader_forward_clustered.cpp:239-241`. */
export function usesBlendAlpha(
  blendMode: EnumValue<typeof BlendMode>,
  alphaAntialiasing: EnumValue<typeof AlphaAntiAliasing>
): boolean {
  return !turnsOnAlphaToCoverage(alphaAntialiasing) && blendMode !== BlendMode.MIX;
}
