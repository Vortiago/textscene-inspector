/**
 * Godot 4.6.3's screen-space reflection buffers: the size the trace runs at and the mips of its
 * depth pyramid and colour chain (`servers/rendering/renderer_rd/effects/ss_effects.cpp:1432-1469`).
 */

interface BufferSize {
  width: number;
  height: number;
}

/** The size the trace runs at: the internal size, halved with integer division under `half_size`. */
export function ssrTraceSize(internal: BufferSize, halfSize: boolean): BufferSize {
  if (!halfSize) return { width: internal.width, height: internal.height };
  return { width: Math.trunc(internal.width / 2), height: Math.trunc(internal.height / 2) };
}

/**
 * The mips of the depth pyramid and the colour chain at `size`: the base, and one per halving while
 * both sides stay above 1 (`ss_effects.cpp:1440-1452`).
 */
export function ssrMipCount(size: BufferSize): number {
  let { width, height } = size;
  let mips = 1;
  while (width > 1 && height > 1) {
    width = Math.trunc(width / 2);
    height = Math.trunc(height / 2);
    mips++;
  }
  return mips;
}
