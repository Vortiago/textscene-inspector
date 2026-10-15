/**
 * `Viewport.MSAA`, the multisample mode of a viewport's 2D and 3D buffers. Both default to
 * `MSAA_DISABLED` (`scene/main/viewport.h:309-310`), and so do the root viewport's project settings
 * (`servers/rendering/rendering_server.cpp:3773-3774`).
 */

/**
 * `Viewport.MSAA` in enum order (`scene/main/viewport.h:119-125`), each mode with its samples per
 * pixel (`texture_storage.cpp:3607-3612`).
 */
const VIEWPORT_MSAA = [
  { label: 'DISABLED', samples: 0 },
  { label: '2X', samples: 2 },
  { label: '4X', samples: 4 },
  { label: '8X', samples: 8 },
] as const;

/** Every `Viewport.MSAA` value, 0 to `MSAA_MAX - 1`. */
export const MSAA_MODES: readonly number[] = VIEWPORT_MSAA.map((_, mode) => mode);

/** The `Viewport.MSAA` constant names without their `MSAA_` prefix, by value. */
export const MSAA_LABELS: Readonly<Record<number, string>> = Object.fromEntries(
  VIEWPORT_MSAA.map(({ label }, mode) => [mode, label])
);

/**
 * The samples a render target takes for `mode`: 0, three's "no multisampled buffer", for
 * MSAA_DISABLED. A mode outside the enum is 0 too, since `set_msaa_2d` and `set_msaa_3d` refuse it
 * (`ERR_FAIL_INDEX`, `viewport.cpp:3748`, `:3763`) and the viewport keeps its default.
 */
export function msaaSampleCount(mode: number): number {
  return VIEWPORT_MSAA[mode]?.samples ?? 0;
}

/**
 * The samples a device draws for `requested`: the closest count at or below it that `supported`
 * lists, else 0, as Godot's Vulkan driver picks (`rendering_device_driver_vulkan.cpp:1998-2015`).
 */
export function supportedSampleCount(requested: number, supported: readonly number[]): number {
  return Math.max(0, ...supported.filter((count) => count <= requested));
}
