/** applyLoopOverride maps the preview loop override to a THREE action's loop. */
import { describe, expect, it, vi } from 'vitest';
import { LoopOnce, LoopPingPong, LoopRepeat, type AnimationAction } from 'three';
import { AnimationLoopMode } from '../../godot/scene/animation';
import {
  applyLoopOverride,
  loopsUnderOverride,
  loopSettingsFor,
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
    applyLoopOverride(action, 'once', loopSettingsFor(AnimationLoopMode.LINEAR));
    expect(action.setLoop).toHaveBeenCalledWith(LoopOnce, 1);
    expect(action.clampWhenFinished).toBe(true);
  });

  it("'loop' forces an infinite repeat regardless of the authored settings", () => {
    const action = makeAction();
    applyLoopOverride(action, 'loop', { loop: LoopOnce, repetitions: 1, clampWhenFinished: true });
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

describe('loopSettingsFor', () => {
  it('maps LOOP_NONE to one clamped pass', () => {
    expect(loopSettingsFor(AnimationLoopMode.NONE)).toEqual({
      loop: LoopOnce,
      repetitions: 1,
      clampWhenFinished: true,
    });
  });

  it('maps LOOP_LINEAR to an infinite repeat', () => {
    expect(loopSettingsFor(AnimationLoopMode.LINEAR)).toEqual({
      loop: LoopRepeat,
      repetitions: Infinity,
      clampWhenFinished: false,
    });
  });

  it('maps LOOP_PINGPONG to an infinite ping-pong', () => {
    expect(loopSettingsFor(AnimationLoopMode.PINGPONG).loop).toBe(LoopPingPong);
  });

  it('plays a value outside the enum once', () => {
    expect(loopSettingsFor(7).loop).toBe(LoopOnce);
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
