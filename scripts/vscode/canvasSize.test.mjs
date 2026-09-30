import { describe, expect, it } from 'vitest';
import { isSizedCanvas } from './canvasSize.mjs';

describe('isSizedCanvas', () => {
  it('accepts a canvas the viewport has laid out', () => {
    expect(isSizedCanvas({ width: 565, height: 430 })).toBe(true);
  });

  it('refuses the 300x150 a canvas has before anything sizes it', () => {
    expect(isSizedCanvas({ width: 300, height: 150 })).toBe(false);
  });

  it('refuses a canvas too small to be the viewport', () => {
    expect(isSizedCanvas({ width: 40, height: 400 })).toBe(false);
    expect(isSizedCanvas({ width: 400, height: 40 })).toBe(false);
  });
});
