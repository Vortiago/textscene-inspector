/**
 * Godot's PCF kernel for an omni or spot shadow at the default soft shadow filter quality: the
 * Vogel disk `get_vogel_disk` fills (`servers/rendering/renderer_rd/renderer_scene_render_rd.cpp:45-55`),
 * which each fragment turns by an angle from `quick_hash`
 * (`servers/rendering/renderer_rd/shaders/scene_forward_lights_inc.glsl:278-281`, `:343-350`).
 */

/**
 * Soft Low's `soft_shadow_samples` (`renderer_scene_render_rd.cpp:1157-1160`), the default of
 * `rendering/lights_and_shadows/positional_shadow/soft_shadow_filter_quality`
 * (`servers/rendering/rendering_server.cpp:3710`).
 */
export const SOFT_LOW_SHADOW_SAMPLES = 4;

/** `get_vogel_disk`'s `golden_angle` (`renderer_scene_render_rd.cpp:46`): 2.4, not the true 2.39996. */
const VOGEL_GOLDEN_ANGLE = 2.4;

/**
 * The `count` taps of `get_vogel_disk` (`renderer_scene_render_rd.cpp:45-55`), each `[x, y]` in units
 * of the kernel's radius. Each value is the float Godot computes and stores.
 */
export function vogelDisk(count: number): [number, number][] {
  const f = Math.fround;
  return Array.from({ length: count }, (_, i) => {
    const r = f(f(Math.sqrt(f(i + 0.5))) / f(Math.sqrt(count)));
    const theta = f(i * f(VOGEL_GOLDEN_ANGLE));
    return [f(f(Math.cos(theta)) * r), f(f(Math.sin(theta)) * r)];
  });
}
