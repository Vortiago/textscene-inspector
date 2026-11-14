/**
 * The bitmap FreeType loads for a glyph of a strike (`FT_Bitmap` and the slot's bitmap origin), as
 * the `CBDT`/`EBDT` decoder and the `sbix` reader hand it on.
 */

/** `FT_Pixel_Mode` of a strike bitmap: 1, 2, 4 or 8 bits of coverage, or premultiplied BGRA. */
export type StrikePixelMode = 'mono' | 'gray2' | 'gray4' | 'gray' | 'bgra';

export interface StrikeBitmap {
  readonly pixelMode: StrikePixelMode;
  readonly width: number;
  readonly rows: number;
  /** Bytes from one row to the next. */
  readonly pitch: number;
  readonly buffer: Uint8Array;
  /** `bitmap_left`: the px from the glyph origin to the bitmap's left edge. */
  readonly left: number;
  /** `bitmap_top`: the px from the baseline up to the bitmap's top edge. */
  readonly top: number;
}

/** The pixel mode and the row length of a strike of `bitDepth` bits (`tt_sbit_decoder_alloc_bitmap`), or null for a depth FreeType refuses. */
export function pixelLayoutOf(
  bitDepth: number,
  width: number
): { pixelMode: StrikePixelMode; pitch: number } | null {
  switch (bitDepth) {
    case 1:
      return { pixelMode: 'mono', pitch: (width + 7) >> 3 };
    case 2:
      return { pixelMode: 'gray2', pitch: (width + 3) >> 2 };
    case 4:
      return { pixelMode: 'gray4', pitch: (width + 1) >> 1 };
    case 8:
      return { pixelMode: 'gray', pitch: width };
    case 32:
      return { pixelMode: 'bgra', pitch: width * 4 };
    default:
      return null;
  }
}
