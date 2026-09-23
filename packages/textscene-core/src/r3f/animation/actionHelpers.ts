/**
 * Action helpers for mixer drivers. A freshly `play()`-ed action takes weight 1,
 * which over-blends an AnimationTree pose on a seek, so these re-apply `weight`
 * and `timeScale` in the same call as `play()`.
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
 * Seek a paused action to `time`: start it (re-applying weight/timeScale on
 * the same call as play(), so the weight invariant holds whether or not the
 * action was already running), then hold it paused at the target time.
 */
export function seekAction(action: AnimationAction, time: number, opts: ActionOpts = {}): void {
  startAction(action, opts);
  action.paused = true;
  action.time = time;
}
