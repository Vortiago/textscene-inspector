import { describe, expect, it } from 'vitest';
import { SteadyWork } from './steadyWork.mjs';

const LOADING = { drawCalls: 3078, steps: {} };
const LOADED = { drawCalls: 269, steps: {} };
/** Three times a reflection probe's ten-frame lull after its resources settle. */
const STEADY_FRAMES = 30;

describe('SteadyWork', () => {
  it('answers the work once it has stayed the same over 30 frames', () => {
    const steady = new SteadyWork();
    steady.observe(LOADED, 5);
    expect(steady.observe(LOADED, STEADY_FRAMES - 1)).toBeNull();
    expect(steady.observe(LOADED, 1)).toBe(LOADED);
  });

  it('starts the count again when the work changes, as it does while a scene loads', () => {
    const steady = new SteadyWork();
    steady.observe(LOADING, 1);
    steady.observe(LOADING, STEADY_FRAMES - 1);
    expect(steady.observe(LOADED, 1)).toBeNull();
    expect(steady.observe(LOADED, STEADY_FRAMES)).toBe(LOADED);
  });

  it("counts no frames for a window's first sight of the work (edge case)", () => {
    expect(new SteadyWork().observe(LOADED, STEADY_FRAMES)).toBeNull();
  });
});
