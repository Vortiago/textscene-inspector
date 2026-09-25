/** The WebGL device limits the previewer assumes, where Godot asks the device itself. */

/**
 * The per-axis texture size the previewer assumes, WebGL2's common `MAX_TEXTURE_SIZE`. Godot leaves
 * this ceiling to the device and refuses a larger upload (`rendering_device.cpp:973`).
 */
export const MAX_TEXTURE_EXTENT = 16384;
