import { describe, expect, it } from 'vitest';
import { quantizeVertexColor, quantizeVertexColorChannel } from './vertexColorQuantize';

describe('quantizeVertexColorChannel', () => {
  // Each expected byte is Godot's cast `uint8_t(CLAMP(src[i].r * 255.0, 0.0, 255.0))`
  // (godot-src/servers/rendering/rendering_server.cpp:713-716, reached from
  // godot-src/scene/2d/polygon_2d.cpp:395), which truncates toward zero.
  // `pnpm ref:godot --mode 2d` agrees on the colours noted below.
  it('truncates rather than rounds a fractional byte at or above the half boundary', () => {
    // 0.1 * 255 = 25.5: rounding gives 26, truncation 25. Godot draws
    // Color(0.08, 0.08, 0.10) as rgb(20, 20, 25).
    expect(quantizeVertexColorChannel(0.1) * 255).toBeCloseTo(25, 5);
    // 0.9 * 255 = 229.5: rounding gives 230, truncation 229. Godot draws
    // Color(0.40, 0.90, 0.50) as rgb(102, 229, 127).
    expect(quantizeVertexColorChannel(0.9) * 255).toBeCloseTo(229, 5);
    // 0.5 * 255 = 127.5: rounding gives 128, truncation 127.
    expect(quantizeVertexColorChannel(0.5) * 255).toBeCloseTo(127, 5);
    // 0.85 * 255 = 216.75: rounding gives 217, truncation 216. Godot draws
    // Color(0.85, 0.85, 0.80) as rgb(216, 216, 204).
    expect(quantizeVertexColorChannel(0.85) * 255).toBeCloseTo(216, 5);
  });

  it('leaves a byte-exact channel unchanged', () => {
    expect(quantizeVertexColorChannel(0) * 255).toBeCloseTo(0, 5);
    expect(quantizeVertexColorChannel(1) * 255).toBeCloseTo(255, 5);
    expect(quantizeVertexColorChannel(0.4) * 255).toBeCloseTo(102, 5);
    expect(quantizeVertexColorChannel(0.8) * 255).toBeCloseTo(204, 5);
  });

  it('clamps outside [0, 1] the way CLAMP(x * 255.0, 0.0, 255.0) does', () => {
    expect(quantizeVertexColorChannel(-0.5)).toBe(0);
    expect(quantizeVertexColorChannel(1.5) * 255).toBeCloseTo(255, 5);
  });
});

describe('quantizeVertexColor', () => {
  it('quantizes r, g, b and a independently', () => {
    const q = quantizeVertexColor({ r: 0.9, g: 0.5, b: 0.1, a: 0.85 });
    expect(q.r * 255).toBeCloseTo(229, 5);
    expect(q.g * 255).toBeCloseTo(127, 5);
    expect(q.b * 255).toBeCloseTo(25, 5);
    expect(q.a * 255).toBeCloseTo(216, 5);
  });
});
