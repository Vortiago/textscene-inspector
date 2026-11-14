import { describe, expect, it } from 'vitest';
import type { SfntOutlines } from '../sfntOutlines';
import type { FaceStrikes } from '../strike/faceStrikes';
import type { SvgGlyphs } from '../svg/svgGlyphs';
import { drawsColourGlyphs } from './colourGlyphs';

const outlinesWith = (colourForm: Partial<SfntOutlines>): SfntOutlines => colourForm as SfntOutlines;

describe('drawsColourGlyphs', () => {
  it('holds for a face that draws its glyphs from colour strikes', () => {
    expect(drawsColourGlyphs(outlinesWith({ strikes: {} as FaceStrikes }))).toBe(true);
  });

  it('holds for a face with SVG glyphs', () => {
    expect(drawsColourGlyphs(outlinesWith({ svgGlyphs: {} as SvgGlyphs }))).toBe(true);
  });

  it('holds for a face with COLR layers', () => {
    expect(drawsColourGlyphs(outlinesWith({ colourLayers: () => null }))).toBe(true);
  });

  it('does not hold for a face of outlines alone', () => {
    expect(drawsColourGlyphs(outlinesWith({}))).toBe(false);
  });
});
