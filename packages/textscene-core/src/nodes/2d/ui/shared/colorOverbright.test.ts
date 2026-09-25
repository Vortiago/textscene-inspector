import { describe, expect, it } from 'vitest';
import { isColorOverbright } from './colorOverbright';

describe('isColorOverbright', () => {
  // scene/gui/color_picker.cpp:56-58: any channel strictly greater than 1.
  it('is false for every channel within [0,1]', () => {
    expect(isColorOverbright({ r: 1, g: 0.5, b: 0 })).toBe(false);
  });

  it('is true when the red channel exceeds 1', () => {
    expect(isColorOverbright({ r: 1.2, g: 0, b: 0 })).toBe(true);
  });

  it('is true at the boundary-adjacent green/blue channels too', () => {
    expect(isColorOverbright({ r: 0, g: 1.0001, b: 0 })).toBe(true);
    expect(isColorOverbright({ r: 0, g: 0, b: 1.0001 })).toBe(true);
  });
});
