/**
 * Which surfaces the Forward+ renderer draws into a shadow map: those that draw depth, from the
 * opaque list or from the alpha pass through a depth prepass.
 */

/**
 * Where a surface draws: `uses_alpha_pass()` and `uses_depth_in_alpha_pass()`
 * (`scene_shader_forward_clustered.h:279-293`).
 */
export interface PassMembership {
  alphaPass: boolean;
  depthInAlphaPass: boolean;
}

/** `FLAG_PASS_SHADOW` (`render_forward_clustered.cpp:4078-4088`). */
export function drawsInShadowPass({ alphaPass, depthInAlphaPass }: PassMembership): boolean {
  return !alphaPass || depthInAlphaPass;
}
