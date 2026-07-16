/**
 * applyLoopOverride — the ONE place the preview loop override maps to
 * THREE action loop config, shared by the AnimationPlayer and GLB drivers.
 */
import { describe, expect, it, vi } from 'vitest';
import { LoopOnce, LoopPingPong, LoopRepeat, type AnimationAction } from 'three';
import {
  applyLoopOverride,
  loopsUnderOverride,
  LOOP_ONCE_SETTINGS,
  LOOP_REPEAT_SETTINGS,
  type ActionLoopSettings,
} from './loopOverride';

function makeAction() {
  return { setLoop: vi.fn(), clampWhenFinished: false } as unknown as AnimationAction & {
    setLoop: ReturnType<typeof vi.fn>;
  };
}

describe('applyLoopOverride', () => {
  it("'once' forces a single clamped pass regardless of the authored settings", () => {
    const action = makeAction();
    applyLoopOverride(action, 'once', LOOP_REPEAT_SETTINGS);
    expect(action.setLoop).toHaveBeenCalledWith(LoopOnce, 1);
    expect(action.clampWhenFinished).toBe(true);
  });

  it("'loop' forces an infinite repeat regardless of the authored settings", () => {
    const action = makeAction();
    applyLoopOverride(action, 'loop', LOOP_ONCE_SETTINGS);
    expect(action.setLoop).toHaveBeenCalledWith(LoopRepeat, Infinity);
    expect(action.clampWhenFinished).toBe(false);
  });

  it("'auto' applies the authored settings unchanged (incl. modes the override can't express)", () => {
    const authored: ActionLoopSettings = {
      loop: LoopPingPong,
      repetitions: Infinity,
      clampWhenFinished: false,
    };
    const action = makeAction();
    applyLoopOverride(action, 'auto', authored);
    expect(action.setLoop).toHaveBeenCalledWith(LoopPingPong, Infinity);
    expect(action.clampWhenFinished).toBe(false);
  });
});

describe('loopsUnderOverride', () => {
  it("'once' never repeats, even when the authored clip loops", () => {
    expect(loopsUnderOverride('once', true)).toBe(false);
  });

  it("'once' stays non-repeating when the authored clip already doesn't loop", () => {
    expect(loopsUnderOverride('once', false)).toBe(false);
  });

  it("'loop' always repeats, even when the authored clip doesn't loop", () => {
    expect(loopsUnderOverride('loop', false)).toBe(true);
  });

  it("'loop' stays repeating when the authored clip already loops", () => {
    expect(loopsUnderOverride('loop', true)).toBe(true);
  });

  it("'auto' passes the authored loop flag through unchanged (true)", () => {
    expect(loopsUnderOverride('auto', true)).toBe(true);
  });

  it("'auto' passes the authored loop flag through unchanged (false)", () => {
    expect(loopsUnderOverride('auto', false)).toBe(false);
  });
});
