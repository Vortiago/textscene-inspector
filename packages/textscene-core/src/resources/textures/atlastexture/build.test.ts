/**
 * The DOM half of the AtlasTexture slice: cutting a cell out of a decoded sheet
 * for the controls that render an `<img>`.
 *
 * The geometry is tested directly because happy-dom has no canvas — the data-URL
 * wrapper can only be checked for its documented graceful `undefined`. Pixel
 * proof for the crop lives in `pnpm verify:2d` (ADR-0024), the only gate that
 * sees the DOM overlay.
 */
import { describe, it, expect } from 'vitest';
import { atlasCropRect, atlasRegionDataUrl } from './build';

const SHEET = { width: 64, height: 32 };

describe('atlasCropRect', () => {
  it('maps a cell to its source rect in the sheet', () => {
    expect(atlasCropRect(SHEET, { x: 16, y: 0, width: 16, height: 16 })).toEqual({
      sx: 16,
      sy: 0,
      width: 16,
      height: 16,
    });
  });

  it('clips a cell that overruns the sheet (Godot intersects the region)', () => {
    expect(atlasCropRect(SHEET, { x: 56, y: 24, width: 32, height: 32 })).toEqual({
      sx: 56,
      sy: 24,
      width: 8,
      height: 8,
    });
  });

  it('clamps a negative origin into the sheet', () => {
    expect(atlasCropRect(SHEET, { x: -8, y: -4, width: 16, height: 16 })).toEqual({
      sx: 0,
      sy: 0,
      width: 8,
      height: 12,
    });
  });

  it('returns null for a cell entirely outside the sheet', () => {
    expect(atlasCropRect(SHEET, { x: 100, y: 0, width: 16, height: 16 })).toBeNull();
    expect(atlasCropRect(SHEET, { x: 0, y: 40, width: 16, height: 16 })).toBeNull();
  });

  it('returns null for a degenerate cell', () => {
    expect(atlasCropRect(SHEET, { x: 0, y: 0, width: 0, height: 16 })).toBeNull();
  });
});

describe('atlasRegionDataUrl', () => {
  it('degrades to undefined for an image that cannot be drawn', () => {
    // happy-dom: no 2D context. Callers fall back to their pending/placeholder
    // branch exactly as they already do for an undecoded image.
    expect(atlasRegionDataUrl(undefined, { x: 0, y: 0, width: 16, height: 16 })).toBeUndefined();
    expect(atlasRegionDataUrl({}, { x: 0, y: 0, width: 16, height: 16 })).toBeUndefined();
  });
});
