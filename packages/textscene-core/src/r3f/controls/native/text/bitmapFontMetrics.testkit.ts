/** The test BMFont (`descriptor.testkit.ts`) as `FontMetrics`, with a blank 64 x 32 page for fill 0. */

import { FixedSizeScaleMode } from '../../../../godot/text/textServerEnums';
import { TEXT_DESCRIPTOR } from '../../../../resources/formats/bmfont/descriptor.testkit';
import { parseDescriptor } from '../../../../resources/formats/bmfont/parseDescriptor';
import type { BitmapFont } from '../../../../resources/fonts/font/types';
import { createBitmapFontMetrics, type BitmapFontMetrics } from './bitmapFontMetrics';

export function testBitmapFont(scaleMode: number = FixedSizeScaleMode.FIXED_SIZE_SCALE_ENABLED): BitmapFont {
  const descriptor = parseDescriptor(new TextEncoder().encode(TEXT_DESCRIPTOR).buffer as ArrayBuffer);
  return {
    fixedSize: descriptor.fixedSize,
    ascent: descriptor.ascent,
    descent: descriptor.descent,
    glyphs: descriptor.glyphs,
    kerning: descriptor.kerning,
    fills: [{ width: 64, height: 32, data: new Uint8Array(64 * 32 * 4).fill(255) }],
    scaleMode,
  };
}

export function testBitmapMetrics(scaleMode?: number): BitmapFontMetrics {
  return createBitmapFontMetrics(testBitmapFont(scaleMode));
}
