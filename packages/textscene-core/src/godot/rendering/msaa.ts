/**
 * `Viewport.MSAA`, the multisample mode of a viewport's 2D and 3D buffers. Both default to
 * `MSAA_DISABLED` (`scene/main/viewport.h:309-310`), and so do the root viewport's project settings
 * (`servers/rendering/rendering_server.cpp:3773-3774`).
 */

/**
 * Each mode by value (`scene/main/viewport.h:119-125`): the name Godot binds, and the samples per
 * pixel its render target takes (`texture_storage.cpp:3607-3612`), 0 for no multisampled buffer.
 * The enum stops at 8X, since Godot leaves 16X out.
 */
const MSAA_MODE_TABLE = [
  { label: 'DISABLED', samples: 0 },
  { label: '2X', samples: 2 },
  { label: '4X', samples: 4 },
  { label: '8X', samples: 8 },
] as const;

export const MSAA_DISABLED = 0;

/** Every mode value, as a parser's enum accepts them. */
export const MSAA_MODES: readonly number[] = MSAA_MODE_TABLE.map((_, mode) => mode);

/** The last mode, 8X. */
export const MSAA_MAX = MSAA_MODES.length - 1;

/** The name Godot binds for each mode, for a diagnostic that reports the legal values. */
export const MSAA_MODE_LABELS: Record<number, string> = Object.fromEntries(
  MSAA_MODE_TABLE.map(({ label }, mode) => [mode, label])
);

/**
 * The samples a render target takes for `mode`: 0, three's "no multisampled buffer", for
 * MSAA_DISABLED. A mode outside the enum is 0 too, since `set_msaa_2d` and `set_msaa_3d` refuse it
 * (`ERR_FAIL_INDEX`, `viewport.cpp:3748`, `:3763`) and the viewport keeps its default.
 */
export function msaaSampleCount(mode: number): number {
  return MSAA_MODE_TABLE[mode]?.samples ?? 0;
}

/**
 * The samples a device draws for `requested`: the closest count at or below it that `supported`
 * lists, else 0, as Godot's Vulkan driver picks (`rendering_device_driver_vulkan.cpp:1998-2015`).
 */
export function supportedSampleCount(requested: number, supported: readonly number[]): number {
  return Math.max(0, ...supported.filter((count) => count <= requested));
}
