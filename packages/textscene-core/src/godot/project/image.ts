/**
 * Godot's `Image`: the pixel ceiling it allocates under, and how it turns a byte into a float channel
 * and back.
 */

/**
 * `Image::MAX_PIXELS` (`core/io/image.h:71`), 16384². `Image::initialize_data` refuses a larger
 * image with `ERR_FAIL_COND_MSG` (`core/io/image.cpp:2421`) and leaves it empty.
 */
export const IMAGE_MAX_PIXELS = 268435456;

/** A byte as `Image::get_pixel` reads it: divided in double precision, stored as a float32. */
export function channelOf(byte: number): number {
  return Math.fround(byte / 255);
}

/**
 * A channel as `Image::_set_color_at_ofs` writes it (`core/io/image.cpp:3555`): clamped, then
 * truncated.
 */
export function byteOf(channel: number): number {
  return Math.trunc(Math.min(255, Math.max(0, channel * 255)));
}
