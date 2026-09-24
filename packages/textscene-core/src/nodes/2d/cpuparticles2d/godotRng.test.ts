/**
 * Reference values from Godot 4.6.3 itself (a headless GDScript that seeds a
 * `RandomNumberGenerator` and prints `randf()`), so these pin a bit-exact port.
 */

import { describe, expect, it } from 'vitest';
import { GodotRandomPCG, idhash, randFromSeed } from './godotRng';

const GODOT_RANDF: ReadonlyArray<{ seed: number; values: number[] }> = [
  { seed: 0, values: [0.2022718489, 0.1253594011, 0.3585808575, 0.1688661575, 0.8592844009, 0.4720523059] },
  { seed: 1, values: [0.3295590878, 0.2765948474, 0.5098096132, 0.7420216799, 0.5238704085, 0.0474536046] },
  { seed: 2, values: [0.7028823495, 0.5193672776, 0.2134724110, 0.9584894776, 0.2590015531, 0.5367252827] },
  { seed: 7, values: [0.4315069616, 0.7070699930, 0.9004028440, 0.6705743074, 0.8003195524, 0.7556833625] },
  { seed: 12345, values: [0.2520419061, 0.6666730046, 0.0230819341, 0.7422416806, 0.8732622266, 0.9771048427] },
  { seed: 4294967295, values: [0.3018874228, 0.3225597441, 0.3944268525, 0.4148420990, 0.2915952802, 0.1041916087] },
];

describe('GodotRandomPCG', () => {
  for (const { seed, values } of GODOT_RANDF) {
    it(`matches Godot's randf() stream for seed ${seed}`, () => {
      const rng = new GodotRandomPCG(seed);
      for (const expected of values) {
        expect(rng.randf()).toBeCloseTo(expected, 9);
      }
    });
  }

  it('restarts the same stream when reseeded with the same value', () => {
    const rng = new GodotRandomPCG(1);
    const first = [rng.randf(), rng.randf(), rng.randf()];
    rng.seed(1);
    expect([rng.randf(), rng.randf(), rng.randf()]).toEqual(first);
  });

  it('produces values strictly inside 0..1', () => {
    const rng = new GodotRandomPCG(99);
    for (let i = 0; i < 500; i++) {
      const value = rng.randf();
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('wraps a seed beyond 32 bits instead of throwing (edge case)', () => {
    expect(() => new GodotRandomPCG(2 ** 40).randf()).not.toThrow();
  });
});

describe('idhash', () => {
  it('is a pure function of its input', () => {
    expect(idhash(7)).toBe(idhash(7));
    expect(idhash(7)).not.toBe(idhash(8));
  });

  it('stays inside the unsigned 32-bit range', () => {
    for (const x of [0, 1, 2, 65535, 0x7fffffff, 0xffffffff]) {
      const hashed = idhash(x);
      expect(Number.isInteger(hashed)).toBe(true);
      expect(hashed).toBeGreaterThanOrEqual(0);
      expect(hashed).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('maps 0 to 0 (the multiply-xor chain has no additive term)', () => {
    expect(idhash(0)).toBe(0);
  });
});

describe('randFromSeed', () => {
  it('advances the seed in place and returns a 0..1 value (happy path)', () => {
    const state = { value: 12345 };
    const first = randFromSeed(state);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(1);
    expect(state.value).not.toBe(12345);

    const second = randFromSeed(state);
    expect(second).not.toBe(first);
  });

  it('substitutes Godot’s fixed constant for a zero seed (error path)', () => {
    // `rand_from_seed` maps s == 0 to 305420679 so a zero seed is not a fixed point.
    const zero = { value: 0 };
    const substituted = { value: 305420679 };
    expect(randFromSeed(zero)).toBe(randFromSeed(substituted));
  });

  it('is deterministic for a given starting seed', () => {
    const a = { value: 7 };
    const b = { value: 7 };
    expect([randFromSeed(a), randFromSeed(a)]).toEqual([randFromSeed(b), randFromSeed(b)]);
  });
});
