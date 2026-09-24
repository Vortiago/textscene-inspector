/**
 * How large a texture Godot can build and upload. The pixel ceiling on an Image is the engine's
 * own. The per-axis ceiling on an upload belongs to the GPU driver, which Godot asks each time.
 */

/**
 * `Image::MAX_PIXELS` (`core/io/image.h:71`), 16384². `Image::initialize_data` refuses a larger
 * image with `ERR_FAIL_COND_MSG` (`core/io/image.cpp:2421`) and leaves it empty.
 */
export const IMAGE_MAX_PIXELS = 268435456;

/**
 * The per-axis texture size the previewer assumes, WebGL2's common `MAX_TEXTURE_SIZE`. Godot leaves
 * this ceiling to the device and refuses a larger upload (`rendering_device.cpp:973`).
 */
export const MAX_TEXTURE_EXTENT = 16384;
