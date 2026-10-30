/** The process-wide draws and the POINTS and DIRECTED_POINTS steps both emitters share, against values Godot 4.6.3 printed. */

import { describe, expect, it } from 'vitest';
import { GodotRandomPCG } from './godotRng';
import { DEFAULT_PREVIEW_SEED } from './process';
import { storedVector2 } from '../../../godot/math/real.js';
import { pickPoint, previewProcessRng, processRandf, turnedByNormal } from './emissionPoints';

describe('processRandf', () => {
  it('takes one `rand()` word over `(float)UINT32_MAX`, not the two `RandomPCG::randf` draws', () => {
    // Godot's `randi()` after `seed = 0` gives 881477183, then 1327520283.
    const rng = new GodotRandomPCG(0);
    expect(processRandf(rng)).toBe(Math.fround(Math.fround(881477183) / 2 ** 32));
    expect(rng.rand()).toBe(1327520283);
  });

  it('reaches 1 for a word that rounds up to 2^32 in float (edge case)', () => {
    const rng = { rand: () => 0xffffffff } as GodotRandomPCG;
    expect(processRandf(rng)).toBe(1);
  });
});

describe('previewProcessRng', () => {
  it("draws apart from the stream of an unseeded emitter's first particle", () => {
    // That particle seeds its own stream with the preview seed, and Godot's clock-seeded stream is independent of it.
    expect(previewProcessRng().rand()).not.toBe(new GodotRandomPCG(DEFAULT_PREVIEW_SEED).rand());
  });
});

describe('pickPoint', () => {
  it('takes `Math::rand() % count` from the stream (happy path)', () => {
    // Godot's `randi()` after `seed = 0` gives 881477183, then 1327520283.
    const rng = new GodotRandomPCG(0);
    expect([pickPoint(rng, 5), pickPoint(rng, 7)]).toEqual([881477183 % 5, 1327520283 % 7]);
  });

  it('picks nothing, and draws nothing from the stream, for no points (edge case)', () => {
    const rng = new GodotRandomPCG(0);
    expect(pickPoint(rng, 0)).toBeNull();
    expect(rng.rand()).toBe(881477183);
  });
});

describe('turnedByNormal', () => {
  it.each([
    {
      normal: { x: 0.6, y: 0.8 },
      velocity: { x: 3, y: -1.5 },
      turned: { x: 0.6000000238418579, y: 3.3000001907348633 },
    },
    {
      normal: { x: -0.28, y: 0.96 },
      velocity: { x: 0.1, y: 7.25 },
      turned: { x: 6.932000160217285, y: 2.125999927520752 },
    },
  ])("turns $velocity.x, $velocity.y as Godot's `basis_xform` does", ({ normal, velocity, turned }) => {
    // The emitters read both from packed float arrays, as Godot's `Vector2` stores them.
    expect(turnedByNormal(storedVector2(normal), storedVector2(velocity))).toEqual(turned);
  });

  it('keeps the -0 Godot writes, which adding a zero origin would lose (edge case)', () => {
    expect(Object.is(turnedByNormal({ x: 0, y: -1 }, { x: -2, y: 0 }).x, -0)).toBe(true);
  });
});
