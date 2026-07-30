/**
 * Godot's Decal fade terms, as pure maths.
 *
 * `decalFade.ts` carries the formulae and their Godot source citations; this
 * file owns the NUMBERS. Every expected value is hand-computed from Godot's
 * closed form, never read back from our renderer — a value taken from our own
 * output would go green against a wrong implementation and lock it in.
 *
 * The one thing a renderer can silently get backwards is which exponent applies
 * above the origin, so that is pinned twice: by the arithmetic here, and by a
 * real Godot render (`scripts/godot-ref/scenes/decal-fade-sign.tscn`), where a
 * receiver ABOVE the projector at exponent 0 comes back rgb(255,40,42) and an
 * identical one BELOW at exponent 4 comes back rgb(148,122,127) — a red/green
 * ratio of 1.21 against the 1.19 that fade = 0.0625 predicts.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bakeDecalFadeAttribute, decalDistanceFade } from './decalFade';

/**
 * A geometry with the given decal-local vertex Ys, and optionally normals.
 * Positions are what `DecalGeometry` emits; only Y is read by the depth term.
 */
function geometryAt(ys: number[], normalYs?: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(ys.flatMap((y) => [0, y, 0]));
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normalYs) {
    // Only the Y component is read (decal_normal is decal-local +Y); X is
    // padded to keep the vectors unit-length, as DecalGeometry's would be.
    const normals = new Float32Array(normalYs.flatMap((ny) => [Math.sqrt(1 - ny * ny), ny, 0]));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  }
  return geometry;
}

/** The baked alpha per vertex. */
function fades(geometry: THREE.BufferGeometry): number[] {
  const color = geometry.getAttribute('color');
  return Array.from({ length: color.count }, (_, i) => color.getW(i));
}

const NO_FADE = { upperFade: 0, lowerFade: 0, normalFade: 0 };

describe('bakeDecalFadeAttribute', () => {
  it('writes an RGBA color attribute leaving RGB at 1 so only alpha is scaled', () => {
    const geometry = geometryAt([-1]);
    bakeDecalFadeAttribute(geometry, { ...NO_FADE, lowerFade: 0.3 }, 3);

    const color = geometry.getAttribute('color');
    expect(color.itemSize).toBe(4);
    expect(color.getX(0)).toBe(1);
    expect(color.getY(0)).toBe(1);
    expect(color.getZ(0)).toBe(1);
  });

  it('bakes the depth fade the existing decal fixtures actually sit at', () => {
    // unit-decal.tscn: decal at y=1, size.y=3 (half 1.5), floor at y=0.
    // uv_local.y = -1/1.5 = -2/3, lower_fade 0.3 → (1 - 2/3)^0.3 = 0.7192231.
    // That is the ~28% the existing `decal` golden has been too strong by.
    const geometry = geometryAt([-1]);
    bakeDecalFadeAttribute(geometry, { ...NO_FADE, lowerFade: 0.3 }, 3);

    expect(fades(geometry)[0]).toBeCloseTo(0.7192231, 6);
  });

  it('applies upper_fade ABOVE the origin and lower_fade below it', () => {
    // The sign convention, confirmed against a real Godot render. Both vertices
    // sit at |uv_local.y| = 0.5 of a size.y = 4 box, so only the exponent differs.
    const geometry = geometryAt([1, -1]);
    bakeDecalFadeAttribute(geometry, { upperFade: 4, lowerFade: 0, normalFade: 0 }, 4);

    const [above, below] = fades(geometry);
    expect(above).toBeCloseTo(0.0625, 6); // (1 - 0.5)^4
    expect(below).toBeCloseTo(1, 6); // (1 - 0.5)^0
  });

  it('switches exponent across the origin, not somewhere either side of it', () => {
    // Exactly AT the origin the branch is unobservable — the base is 1-|0| = 1
    // and 1^x is 1 for every exponent — so Godot's `> 0` and a `>= 0` cannot be
    // told apart there, and asserting on it would prove nothing. The boundary is
    // observable an epsilon either side, which is what this pins.
    const geometry = geometryAt([0.004, -0.004]);
    bakeDecalFadeAttribute(geometry, { upperFade: 1000, lowerFade: 0, normalFade: 0 }, 4);

    // uv_local.y = ±0.004 / 2 = ±0.002, so the base is 0.998 either side.
    // Above: 0.998^1000 = 0.135065. Below: 0.998^0 = 1.
    const [justAbove, justBelow] = fades(geometry);
    expect(justAbove).toBeCloseTo(0.13506, 4);
    expect(justBelow).toBe(1);
  });

  it('blanks a vertex on the box face and never yields NaN just outside it', () => {
    // pow(0, 0.3) === 0, and a vertex a float-epsilon outside the box would
    // give pow(negative, 0.3) === NaN without the clamp.
    const geometry = geometryAt([-1.5, -1.5000001]);
    bakeDecalFadeAttribute(geometry, { ...NO_FADE, lowerFade: 0.3 }, 3);

    const baked = fades(geometry);
    expect(baked[0]).toBe(0);
    expect(baked[1]).toBe(0);
    expect(baked.every((f) => !Number.isNaN(f))).toBe(true);
  });

  it('applies the normal_fade smoothstep against decal-local +Y', () => {
    // smoothstep(0.5, 1, n.y * 0.5 + 0.5) at n.y = 1, 0.7071, 0:
    //   1     → smoothstep(0.5, 1, 1)       = 1
    //   0.7071→ smoothstep(0.5, 1, 0.85355) = t=0.70711 → t²(3-2t) = 0.79289
    //   0     → smoothstep(0.5, 1, 0.5)     = 0
    const geometry = geometryAt([0, 0, 0], [1, Math.SQRT1_2, 0]);
    bakeDecalFadeAttribute(geometry, { upperFade: 0, lowerFade: 0, normalFade: 0.5 }, 4);

    const [facing, tilted, edgeOn] = fades(geometry);
    expect(facing).toBeCloseTo(1, 6);
    expect(tilted).toBeCloseTo(0.79289, 5);
    expect(edgeOn).toBeCloseTo(0, 6);
  });

  it('skips the normal term entirely at normal_fade = 0', () => {
    // Godot guards the whole term behind `if (normal_fade > 0.0)`, so an
    // edge-on surface keeps full strength rather than smoothstepping to 0.
    const geometry = geometryAt([0], [0]);
    bakeDecalFadeAttribute(geometry, { ...NO_FADE }, 4);

    expect(fades(geometry)[0]).toBeCloseTo(1, 6);
  });

  it('skips the normal term when the receiver supplied no normals', () => {
    // DecalGeometry emits `normal` only when the source geometry has one.
    const geometry = geometryAt([0]);
    bakeDecalFadeAttribute(geometry, { upperFade: 0, lowerFade: 0, normalFade: 0.5 }, 4);

    expect(fades(geometry)[0]).toBeCloseTo(1, 6);
  });

  it('treats a degenerate box depth as no depth fade rather than dividing by zero', () => {
    const geometry = geometryAt([0.5]);
    bakeDecalFadeAttribute(geometry, { ...NO_FADE, lowerFade: 0.3 }, 0);

    expect(fades(geometry)[0]).toBe(1);
  });

  it('writes the attribute even when no fade is authored', () => {
    // Load-bearing, and the reason this is asserted by name rather than left to
    // a comment: the projection material sets `vertexColors` once and shares
    // itself across every receiver, and `vertexColors` against a geometry with
    // NO `color` attribute samples black. So "skip the bake when nothing fades"
    // is not an optimisation available here — it would blank every projection.
    const geometry = geometryAt([-1]);
    bakeDecalFadeAttribute(geometry, NO_FADE, 3);

    expect(geometry.getAttribute('color')).toBeDefined();
    expect(fades(geometry)).toEqual([1]);
  });

  it('steps rather than dividing by zero when normal_fade reaches its upper edge', () => {
    // normal_fade = 1 makes both smoothstep edges 1. Godot's Math::smoothstep
    // returns a step there; an unguarded (x-e0)/(e1-e0) bakes NaN into alpha.
    const geometry = geometryAt([0, 0], [1, -1]);
    bakeDecalFadeAttribute(geometry, { upperFade: 0, lowerFade: 0, normalFade: 1 }, 4);

    const baked = fades(geometry);
    expect(baked.every((f) => !Number.isNaN(f))).toBe(true);
    expect(baked[0]).toBe(1); // n.y = 1 → remapped 1, not below the edge
    expect(baked[1]).toBe(0); // n.y = -1 → remapped 0, below it
  });
});

describe('decalDistanceFade', () => {
  it('is full strength up to `begin`', () => {
    expect(decalDistanceFade(2.5, 4, 2)).toBe(1);
    expect(decalDistanceFade(2.5, 4, 2.5)).toBe(1);
  });

  it('smoothsteps between `begin` and `begin + length`', () => {
    // Godot: smoothstep(0, 1, 1 - (d - begin)/length). At the midpoint the
    // argument is 0.5, and smoothstep(0,1,0.5) = 0.5² × (3 - 2×0.5) = 0.5.
    expect(decalDistanceFade(2.5, 4, 4.5)).toBeCloseTo(0.5, 6);
    // A quarter in: arg 0.75 → 0.75² × (3 - 1.5) = 0.84375
    expect(decalDistanceFade(2.5, 4, 3.5)).toBeCloseTo(0.84375, 6);
  });

  it('is culled beyond `begin + length`', () => {
    expect(decalDistanceFade(2.5, 4, 7)).toBe(0);
  });

  it('hard-cuts at `begin` when length is zero instead of dividing by it', () => {
    // The cull runs first in Godot, so `length = 0` can never reach the divide.
    expect(decalDistanceFade(2.5, 0, 2.4)).toBe(1);
    expect(decalDistanceFade(2.5, 0, 2.6)).toBe(0);
  });
});
