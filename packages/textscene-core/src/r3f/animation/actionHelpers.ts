/**
 * startAction / seekAction — shared action-level helpers for mixer drivers.
 *
 * Both helpers encode the same invariant: a freshly `play()`-ed
 * `THREE.AnimationAction` defaults its weight to 1. For single-action drivers
 * that's fine; for weighted blend programs (AnimationTree) calling play() on a
 * seek would reset all weights to 1 and over-blend the pose. The helpers
 * always re-apply `weight` and `timeScale` on the same call as `play()` so the
 * invariant lives in one place, not in every driver adapter.
 *
 * Used by:
 *   - `usePlaybackLoop` (AnimationPlayer + GLB driver)
 *   - AnimationTree's weighted-blend adapter
 */
import type { AnimationAction } from 'three';

export interface ActionOpts {
  weight?: number;
  timeScale?: number;
}

/**
 * Start an action playing with the given opts. The defaults (weight 1,
 * timeScale 1) match the THREE.AnimationAction built-in so single-action
 * drivers can omit opts entirely.
 */
export function startAction(action: AnimationAction, opts: ActionOpts = {}): void {
  const { weight = 1, timeScale = 1 } = opts;
  action.enabled = true;
  action.paused = false;
  action.setEffectiveWeight(weight);
  action.setEffectiveTimeScale(timeScale);
  action.play();
}

/**
 * Seek a paused action to `time`. Re-applies weight/timeScale after play() so
 * the weight invariant holds whether or not the action was already running.
 */
export function seekAction(action: AnimationAction, time: number, opts: ActionOpts = {}): void {
  const { weight = 1, timeScale = 1 } = opts;
  action.enabled = true;
  action.setEffectiveWeight(weight);
  action.setEffectiveTimeScale(timeScale);
  action.play();
  action.paused = true;
  action.time = time;
}
