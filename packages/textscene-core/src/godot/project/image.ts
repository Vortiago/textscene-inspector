/** Godot's `Image`: the pixel ceiling it allocates under. */

/**
 * `Image::MAX_PIXELS` (`core/io/image.h:71`), 16384². `Image::initialize_data` refuses a larger
 * image with `ERR_FAIL_COND_MSG` (`core/io/image.cpp:2421`) and leaves it empty.
 */
export const IMAGE_MAX_PIXELS = 268435456;
