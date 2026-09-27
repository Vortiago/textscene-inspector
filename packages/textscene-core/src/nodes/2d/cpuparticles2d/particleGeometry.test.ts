import { describe, expect, it } from 'vitest';
import { buildParticleGeometry } from './particleGeometry';
import type { RenderedParticle } from './simulate';
import { TRANSFORM2D_IDENTITY } from '../../../godot/transform2d.js';

function particle(overrides: Partial<RenderedParticle> = {}): RenderedParticle {
  return {
    transform: { ...TRANSFORM2D_IDENTITY },
    color: { r: 1, g: 1, b: 1, a: 1 },
    anim: 0,
    age: 0,
    index: 0,
    ...overrides,
  };
}

describe('buildParticleGeometry', () => {
  it('emits four vertices and two triangles per particle (happy path)', () => {
    const geometry = buildParticleGeometry([particle(), particle()], 8, 8)!;
    expect(geometry.getAttribute('position').count).toBe(8);
    expect(geometry.getIndex()!.count).toBe(12);
    expect(geometry.getAttribute('uv').count).toBe(8);
  });

  it('sizes the quad to the texture and centres it on the particle origin', () => {
    const geometry = buildParticleGeometry([particle()], 10, 4)!;
    const position = geometry.getAttribute('position');
    const xs = Array.from({ length: 4 }, (_, i) => position.getX(i));
    const ys = Array.from({ length: 4 }, (_, i) => position.getY(i));
    expect(Math.min(...xs)).toBeCloseTo(-5, 6);
    expect(Math.max(...xs)).toBeCloseTo(5, 6);
    expect(Math.min(...ys)).toBeCloseTo(-2, 6);
    expect(Math.max(...ys)).toBeCloseTo(2, 6);
  });

  it('negates Y so a Godot +Y-down origin lands below the axis in three space', () => {
    const geometry = buildParticleGeometry(
      [particle({ transform: { ...TRANSFORM2D_IDENTITY, tx: 3, ty: 7 } })],
      2,
      2
    )!;
    const position = geometry.getAttribute('position');
    expect(position.getX(0)).toBeCloseTo(2, 6);
    // Corner 0 is Godot (-1, -1) offset by (3, 7) => (2, 6), then Y-negated.
    expect(position.getY(0)).toBeCloseTo(-6, 6);
  });

  it('puts V = 1 at the quad’s TOP so the texture is not upside down', () => {
    const geometry = buildParticleGeometry([particle()], 4, 4)!;
    const position = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < 4; i++) {
      // Three-space +Y is up. Godot's V origin is the image top, and textures
      // upload flipped, so the top corners must carry V = 1.
      expect(uv.getY(i)).toBeCloseTo(position.getY(i) > 0 ? 1 : 0, 6);
    }
  });

  it('applies the particle basis, so a rotated quad is no longer axis-aligned', () => {
    const rotated = { a: 0, b: 1, c: -1, d: 0, tx: 0, ty: 0 };
    const geometry = buildParticleGeometry([particle({ transform: rotated })], 10, 2)!;
    const position = geometry.getAttribute('position');
    const xs = Array.from({ length: 4 }, (_, i) => position.getX(i));
    // The 10-wide axis has been swung onto Y, so X now spans the 2-wide one.
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(2, 6);
  });

  it('carries a four-component colour attribute, alpha included', () => {
    const geometry = buildParticleGeometry(
      [particle({ color: { r: 1, g: 1, b: 1, a: 0.25 } })],
      2,
      2
    )!;
    const color = geometry.getAttribute('color');
    expect(color.itemSize).toBe(4);
    expect(color.getW(0)).toBeCloseTo(0.25, 6);
  });

  it('converts the particle colour from sRGB to the linear working space', () => {
    const geometry = buildParticleGeometry(
      [particle({ color: { r: 0.5, g: 0.5, b: 0.5, a: 1 } })],
      2,
      2
    )!;
    const color = geometry.getAttribute('color');
    // sRGB 0.5 decodes to ~0.214 linear. An unconverted 0.5 would read washed out.
    expect(color.getX(0)).toBeCloseTo(0.2140, 3);
  });

  it('keeps pose order, which is what draw_order decides', () => {
    const geometry = buildParticleGeometry(
      [
        particle({ transform: { ...TRANSFORM2D_IDENTITY, tx: 0 } }),
        particle({ transform: { ...TRANSFORM2D_IDENTITY, tx: 100 } }),
      ],
      2,
      2
    )!;
    const index = geometry.getIndex()!;
    const position = geometry.getAttribute('position');
    expect(position.getX(index.getX(0))).toBeLessThan(50);
    expect(position.getX(index.getX(6))).toBeGreaterThan(50);
  });

  it('returns null for an empty pose (edge case)', () => {
    expect(buildParticleGeometry([], 8, 8)).toBeNull();
  });

  describe('particles_animation flipbook', () => {
    const strip = { hFrames: 11, vFrames: 1, loop: false };

    it('shrinks the quad to one CELL, not the whole sheet', () => {
      // An 11-frame strip drawn whole renders as a row of eleven flames.
      const geometry = buildParticleGeometry([particle()], 110, 20, strip)!;
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      expect(box.max.x - box.min.x).toBeCloseTo(10, 6);
      expect(box.max.y - box.min.y).toBeCloseTo(20, 6);
    });

    it('windows the UVs onto the cell the anim value selects', () => {
      const geometry = buildParticleGeometry([particle({ anim: 3 / 11 })], 110, 20, strip)!;
      const uv = geometry.getAttribute('uv');
      const us = Array.from({ length: 4 }, (_, i) => uv.getX(i));
      expect(Math.min(...us)).toBeCloseTo(3 / 11, 6);
      expect(Math.max(...us)).toBeCloseTo(4 / 11, 6);
    });

    it('holds on the last cell past the end when `particles_anim_loop` is off', () => {
      const geometry = buildParticleGeometry([particle({ anim: 5 })], 110, 20, strip)!;
      const uv = geometry.getAttribute('uv');
      const us = Array.from({ length: 4 }, (_, i) => uv.getX(i));
      expect(Math.min(...us)).toBeCloseTo(10 / 11, 6);
    });

    it('wraps past the end when `particles_anim_loop` is on', () => {
      const looping = { hFrames: 4, vFrames: 1, loop: true };
      const geometry = buildParticleGeometry([particle({ anim: 5 / 4 })], 40, 20, looping)!;
      const uv = geometry.getAttribute('uv');
      const us = Array.from({ length: 4 }, (_, i) => uv.getX(i));
      // Frame 5 of 4 wraps to frame 1.
      expect(Math.min(...us)).toBeCloseTo(0.25, 6);
    });

    it('walks a v-frames grid down the sheet as well as across', () => {
      const grid = { hFrames: 2, vFrames: 2, loop: false };
      // Frame 2 is the first cell of the second row.
      const geometry = buildParticleGeometry([particle({ anim: 2 / 4 })], 20, 20, grid)!;
      const uv = geometry.getAttribute('uv');
      const us = Array.from({ length: 4 }, (_, i) => uv.getX(i));
      const vs = Array.from({ length: 4 }, (_, i) => uv.getY(i));
      expect(Math.min(...us)).toBeCloseTo(0, 6);
      expect(Math.max(...us)).toBeCloseTo(0.5, 6);
      // Godot's second row is V 0.5..1 top-down, which is 0..0.5 in three space.
      expect(Math.min(...vs)).toBeCloseTo(0, 6);
      expect(Math.max(...vs)).toBeCloseTo(0.5, 6);
    });

    it('leaves the quad and UVs whole when there is no flipbook (edge case)', () => {
      const geometry = buildParticleGeometry([particle({ anim: 0.7 })], 110, 20, null)!;
      geometry.computeBoundingBox();
      expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeCloseTo(110, 6);
      const uv = geometry.getAttribute('uv');
      const us = Array.from({ length: 4 }, (_, i) => uv.getX(i));
      expect(Math.min(...us)).toBe(0);
      expect(Math.max(...us)).toBe(1);
    });

    it('falls back to the first cell for a non-finite anim value (error path)', () => {
      const geometry = buildParticleGeometry([particle({ anim: NaN })], 110, 20, strip)!;
      const uv = geometry.getAttribute('uv');
      expect(uv.getX(0)).toBe(0);
    });

    it('treats a zero frame count as one cell rather than dividing by zero (error path)', () => {
      const geometry = buildParticleGeometry(
        [particle()],
        20,
        20,
        { hFrames: 0, vFrames: 0, loop: false }
      )!;
      geometry.computeBoundingBox();
      expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeCloseTo(20, 6);
    });
  });

  it('handles a 1x1 quad, the size Godot uses with no texture (edge case)', () => {
    const geometry = buildParticleGeometry([particle()], 1, 1)!;
    const position = geometry.getAttribute('position');
    expect(position.getX(0)).toBeCloseTo(-0.5, 6);
  });
});
