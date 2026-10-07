import { describe, expect, it } from 'vitest';
import { quantizeVertexColor } from './vertexColorQuantize';

describe('quantizeVertexColor', () => {
  it('quantizes r, g, b and a independently', () => {
    const q = quantizeVertexColor({ r: 0.9, g: 0.5, b: 0.1, a: 0.85 });
    expect(q.r * 255).toBeCloseTo(229, 5);
    expect(q.g * 255).toBeCloseTo(127, 5);
    expect(q.b * 255).toBeCloseTo(25, 5);
    expect(q.a * 255).toBeCloseTo(216, 5);
  });
});
