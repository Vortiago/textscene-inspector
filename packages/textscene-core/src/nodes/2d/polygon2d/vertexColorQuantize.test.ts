import { describe, expect, it } from 'vitest';
import { quantizeVertexColor, quantizeVertexColorChannel } from './vertexColorQuantize';

describe('quantizeVertexColorChannel', () => {
  // Every expected byte below is Godot's own truncating C-style cast,
  // `uint8_t(CLAMP(src[i].r * 255.0, 0.0, 255.0))`
  // (godot-src/servers/rendering/rendering_server.cpp:713-716, inside
  // `RenderingServer::_surface_set_data`'s `RS::ARRAY_COLOR` case — the array
  // packer `Polygon2D::_notification` reaches via
  // `mesh_create_surface_data_from_arrays` at godot-src/scene/2d/polygon_2d.cpp:395).
  // A C-style `double`→`uint8_t` cast TRUNCATES toward zero; it never rounds.
  // Measured against Godot 4.6.3 (`pnpm ref:godot --mode 2d`):
  //   Color(0.08, 0.08, 0.10) → rgb(20, 20, 25)   [unit-cpuparticles2d-not-emitting.tscn @ 400,120]
  //   Color(0.85, 0.85, 0.80) → rgb(216, 216, 204) [unit-sprite2d-gradienttexture.tscn @ 50,50]
  //   Color(0.40, 0.90, 0.50) → rgb(102, 229, 127) [unit-2d-geometry-parity.tscn @ 310,70]
  it('truncates rather than rounds a fractional byte at or above the half boundary', () => {
    // 0.1 * 255 = 25.5 exactly (within float32 precision) — round-to-nearest
    // gives 26, Godot's truncating cast gives 25.
    expect(quantizeVertexColorChannel(0.1) * 255).toBeCloseTo(25, 5);
    // 0.9 * 255 = 229.5 — round gives 230, truncation gives 229.
    expect(quantizeVertexColorChannel(0.9) * 255).toBeCloseTo(229, 5);
    // 0.5 * 255 = 127.5 — round gives 128, truncation gives 127.
    expect(quantizeVertexColorChannel(0.5) * 255).toBeCloseTo(127, 5);
    // 0.85 * 255 = 216.75 — well past the halfway point, round still gives
    // 217, but Godot's cast still truncates to 216.
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
