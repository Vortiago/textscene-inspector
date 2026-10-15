/**
 * `Viewport.MSAA`, the multisample mode of a viewport's 2D and 3D buffers. Both default to
 * `MSAA_DISABLED` (`scene/main/viewport.h:309-310`), and so do the root viewport's project settings
 * (`servers/rendering/rendering_server.cpp:3773-3774`).
 */

export const MSAA_DISABLED = 0;

/** The samples per pixel of MSAA_2X, MSAA_4X and MSAA_8X (`texture_storage.cpp:3607-3612`). */
const MULTISAMPLED_COUNTS = [2, 4, 8] as const;

/**
 * The samples a render target takes for `mode`: 0, three's "no multisampled buffer", for
 * MSAA_DISABLED. A mode outside the enum is 0 too, since `set_msaa_2d` and `set_msaa_3d` refuse it
 * (`ERR_FAIL_INDEX`, `viewport.cpp:3748`, `:3763`) and the viewport keeps its default.
 */
export function msaaSampleCount(mode: number): number {
  return MULTISAMPLED_COUNTS[mode - 1] ?? 0;
}

/**
 * The samples a device draws for `requested`: the closest count at or below it that `supported`
 * lists, else 0, as Godot's Vulkan driver picks (`rendering_device_driver_vulkan.cpp:1998-2015`).
 */
export function supportedSampleCount(requested: number, supported: readonly number[]): number {
  return Math.max(0, ...supported.filter((count) => count <= requested));
}
