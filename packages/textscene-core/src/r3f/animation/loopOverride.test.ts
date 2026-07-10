/**
 * applyLoopOverride (#224) — the ONE place the preview loop override maps to
 * THREE action loop config, shared by the AnimationPlayer and GLB drivers.
 */
import { describe, expect, it, vi } from 'vitest';
import { LoopOnce, LoopPingPong, LoopRepeat, type AnimationAction } from 'three';
import {
  applyLoopOverride,
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
