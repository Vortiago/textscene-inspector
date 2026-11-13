import { describe, expect, it } from 'vitest';
import { originOf, settle } from './gpuparticles.testkit';

/** One particle straight up at 2 units a second, with no gravity: the section origins are the heights of the path. */
const STRAIGHT_UP = {
  direction: 'Vector3(0, 1, 0)',
  spread: '0',
  initial_velocity_min: '2',
  initial_velocity_max: '2',
  gravity: 'Vector3(0, 0, 0)',
};

const TRAIL_EMITTER = { amount: 1, lifetime: 2, seed: 0 };

/** The height of section `section` of the one particle, before the copy shader moves it. */
function sectionHeight(settled: ReturnType<typeof settle>, section: number): number {
  return originOf(settled.buffer, section)[1];
}

describe('the section origins of a settled trail, as Godot 4.6.3 capture_aabb reports them', () => {
  it('has the head where an emitter without a trail has it', () => {
    const plain = settle({ ...TRAIL_EMITTER, preprocess: 1 }, STRAIGHT_UP);
    expect(originOf(plain.buffer)[1]).toBeCloseTo(2.066667, 5);
  });

  it.each([
    ['trail_lifetime 0.3 and 5 sections', 0.3, 6, { preprocess: 1 }, 2.066667, 1.600001],
    ['trail_lifetime 0.5 and 3 sections', 0.5, 4, { preprocess: 1 }, 2.066667, 1.333334],
    ['fixed_fps 60 (a history of 18 steps)', 0.3, 6, { preprocess: 1, fixedFps: 60 }, 2.0, 1.5],
    [
      'a preprocess of 0.1, where the tail holds the state after step 1',
      0.3,
      6,
      { preprocess: 0.1 },
      0.266667,
      0.066667,
    ],
  ])('puts the head and the tail for %s', (_name, lifetime, sections, emitter, head, tail) => {
    const settled = settle({ ...TRAIL_EMITTER, ...emitter }, STRAIGHT_UP, undefined, { sections, lifetime });
    expect(sectionHeight(settled, 0)).toBeCloseTo(head, 5);
    expect(sectionHeight(settled, sections - 1)).toBeCloseTo(tail, 5);
  });

  it('steps a trail at 60 fps when fixed_fps is 0', () => {
    const settled = settle({ ...TRAIL_EMITTER, preprocess: 1, fixedFps: 0 }, STRAIGHT_UP, undefined, {
      sections: 6,
      lifetime: 0.3,
    });
    expect(sectionHeight(settled, 0)).toBeCloseTo(2.0, 5);
  });

  it('gives every live particle one row for each section', () => {
    const settled = settle({ ...TRAIL_EMITTER, amount: 3, preprocess: 1 }, STRAIGHT_UP, undefined, {
      sections: 6,
      lifetime: 0.3,
    });
    expect(settled.trail).toEqual({ sections: 6, depth: 9, frameDelta: Math.fround(1 / 30) });
    expect(settled.buffer.length).toBe(settled.indices.length * 6 * 20);
  });
});
