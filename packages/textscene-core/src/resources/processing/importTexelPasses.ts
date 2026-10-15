/**
 * The texel passes Godot's texture importer runs after the alpha-border pass
 * (`editor/import/resource_importer_texture.cpp:866-874`), and the channels its compression keeps,
 * on RGBA8 bytes in place. Each returns whether any byte changed, so a caller can keep the
 * original image.
 */

/** `Image::premultiply_alpha` (`core/io/image.cpp:4220-4240`), which runs only on an RGBA8 image. */
export function premultiplyAlpha(data: Uint8Array): boolean {
  let changed = false;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]!;
    for (let c = i; c < i + 3; c++) {
      const premultiplied = (data[c]! * alpha + 255) >> 8;
      if (premultiplied === data[c]) continue;
      data[c] = premultiplied;
      changed = true;
    }
  }
  return changed;
}

/**
 * `_invert_y_channel` (`resource_importer_texture.cpp:657-671`): green becomes `1 - green` through
 * `get_pixel` and `set_pixel`, in float32, truncated to a byte (`core/io/image.cpp:3555-3580`).
 */
export function invertGreen(data: Uint8Array): boolean {
  let changed = false;
  for (let i = 0; i < data.length; i += 4)
    changed = writeChannel(data, i + 1, invertedGreen(data, i)) || changed;
  return changed;
}

/**
 * `invertGreen` on a greyscale image, which stores the brightest channel, `Color::get_v`, so every
 * channel takes it.
 */
export function invertGreyscaleGreen(data: Uint8Array): boolean {
  let changed = false;
  for (let i = 0; i < data.length; i += 4) {
    const brightest = Math.max(channelOf(data[i]!), invertedGreen(data, i), channelOf(data[i + 2]!));
    for (let c = i; c < i + 3; c++) changed = writeChannel(data, c, brightest) || changed;
  }
  return changed;
}

/** `1 - green` of the texel at `index`, in float32. */
function invertedGreen(data: Uint8Array, index: number): number {
  return Math.fround(1 - channelOf(data[index + 1]!));
}

/**
 * The texels an RGTC RedGreen8 texture samples: red and green kept, blue 0 and alpha opaque, since
 * the format stores neither (`core/io/image.cpp:3732-3734`).
 */
export function keepRedGreen(data: Uint8Array): boolean {
  let changed = false;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 2] === 0 && data[i + 3] === 255) continue;
    data[i + 2] = 0;
    data[i + 3] = 255;
    changed = true;
  }
  return changed;
}

/** A byte as `get_pixel` reads it: divided in double precision, stored as a float32. */
function channelOf(byte: number): number {
  return Math.fround(byte / 255);
}

/** Writes `value` as `set_pixel` does, truncated, and returns whether the byte moved. */
function writeChannel(data: Uint8Array, index: number, value: number): boolean {
  const byte = Math.trunc(value * 255);
  if (byte === data[index]) return false;
  data[index] = byte;
  return true;
}
