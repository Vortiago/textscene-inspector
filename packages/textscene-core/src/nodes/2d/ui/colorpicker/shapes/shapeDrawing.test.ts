import { describe, expect, it, vi } from 'vitest';
import * as okhsl from '../okhsl';
import { pickerShapeColor } from './shapeDrawing';

const TEAL = { r: 0.2, g: 0.6, b: 0.5, a: 1 };

describe('pickerShapeColor', () => {
  it('converts to OKHSL only when a shape reads okhsl', () => {
    const toOkhsl = vi.spyOn(okhsl, 'srgbToOkhsl');
    const color = pickerShapeColor(TEAL);
    expect(toOkhsl).not.toHaveBeenCalled();
    expect(color.okhsl).toEqual(okhsl.srgbToOkhsl(TEAL));
    toOkhsl.mockRestore();
  });

  it('converts once for every read of okhsl', () => {
    const color = pickerShapeColor(TEAL);
    expect(color.okhsl).toBe(color.okhsl);
  });
});
