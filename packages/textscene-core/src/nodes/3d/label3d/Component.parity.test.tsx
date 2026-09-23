/**
 * Label3D parser defaults against `label_3d.h`'s field initialisers: billboard
 * DISABLED, pixel_size 0.005 and outline_size 12, and double_sided=false maps to
 * FrontSide. `LabelGlyphs.test.tsx` and `Component.test.tsx` cover render time.
 */
import { describe, it, expect } from 'vitest';
import { parseLabel3D } from './parser';
import { BillboardMode } from './types';

const heading = { type: 'node', attributes: { type: 'Label3D', name: 'L' } };

describe('Label3D parser parity', () => {
  it('billboard defaults to DISABLED', () => {
    expect(parseLabel3D(heading, {}).billboard).toBe(BillboardMode.BILLBOARD_DISABLED);
  });
  it('pixel_size defaults to 0.005', () => {
    expect(parseLabel3D(heading, {}).pixel_size).toBeCloseTo(0.005, 5);
  });
  it('outline_size defaults to 12', () => {
    expect(parseLabel3D(heading, {}).outline_size).toBe(12);
  });
  it('font_size defaults to 32 when the scene omits it', () => {
    expect(parseLabel3D(heading, {}).font_size).toBe(32);
    expect(parseLabel3D(heading, { font_size: '64' }).font_size).toBe(64);
  });
  it('line_spacing defaults to 0 when the scene omits it', () => {
    expect(parseLabel3D(heading, {}).line_spacing).toBe(0);
  });
  it('double_sided defaults to true; parses false', () => {
    expect(parseLabel3D(heading, {}).double_sided).toBe(true);
    expect(parseLabel3D(heading, { double_sided: 'false' }).double_sided).toBe(false);
  });
});
