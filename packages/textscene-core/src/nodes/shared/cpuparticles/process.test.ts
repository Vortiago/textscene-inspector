/** `lerpParam`: Godot's lerp of a parameter slot, by a weight drawn from the particle's seed. */
import { describe, expect, it } from 'vitest';
import { lerpf } from '../../../godot/math/math';
import { lerpParam } from './process';
import { randFromSeed } from './godotRng';

/** `lerpParam` over the one slot `[min, max]`, from seed 7. */
function lerpedFromSeed(min: number, max: number): number {
  return lerpParam([{ min, max }], 0, { value: 7 });
}

/** Godot's `Math::lerp(min, max, rand_from_seed(seed))` from seed 7. */
function godotLerp(min: number, max: number): number {
  return lerpf(min, max, randFromSeed({ value: 7 }));
}

describe('lerpParam', () => {
  it.each([0.1, 3, -2.5])('gives a constant slot %s as Godot lerps it, in float', (value) => {
    expect(lerpedFromSeed(value, value)).toBe(godotLerp(value, value));
  });

  it('gives a constant -0 slot +0, as Godot lerps it (edge case)', () => {
    expect(Object.is(lerpedFromSeed(-0, -0), 0)).toBe(true);
  });

  it('draws the weight from the seed for a constant slot too', () => {
    const seed = { value: 7 };
    lerpParam([{ min: 1, max: 1 }], 0, seed);

    expect(seed.value).not.toBe(7);
  });

  it('lerps a range by the seed', () => {
    expect(lerpedFromSeed(1, 3)).toBe(godotLerp(1, 3));
  });
});
