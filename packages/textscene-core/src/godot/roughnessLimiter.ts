/**
 * The screen-space roughness limiter's project defaults (`servers/rendering/rendering_server.cpp:3776-3778`).
 * It is on by default, and widens roughness where the normal bends fast
 * (`scene_forward_clustered.glsl:1658-1665`).
 */

/** `rendering/anti_aliasing/screen_space_roughness_limiter/amount`. */
export const ROUGHNESS_LIMITER_AMOUNT = 0.25;
/** `rendering/anti_aliasing/screen_space_roughness_limiter/limit`. */
export const ROUGHNESS_LIMITER_LIMIT = 0.18;
