/**
 * Action helpers for mixer drivers. A freshly `play()`-ed action takes weight 1,
 * which over-blends an AnimationTree pose on a seek, so these re-apply `weight`
 * and `timeScale` in the same call as `play()`. They also read and reset the pass of a loop,
 * which THREE keeps to itself.
 */
import { LoopPingPong, type AnimationAction } from 'three';

interface ActionOpts {
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

/** The passes an action has finished, -1 before its first frame. THREE counts them in a private field and offers no reader. */
interface CountsPasses {
  _loopCount: number;
}

/**
 * Whether the action runs the return pass of a `LoopPingPong`. The private count, not a count
 * kept beside it: a second count drifts on any `reset` or `stop` it does not see.
 */
export function isOnReturnPass(action: AnimationAction): boolean {
  const passes = (action as unknown as CountsPasses)._loopCount;
  return action.loop === LoopPingPong && passes > 0 && (passes & 1) === 1;
}

/**
 * The time the action samples its clip at, which is Godot's `current_animation_position`. On the
 * return pass of a `LoopPingPong` THREE keeps `time` running forward and mirrors it only for its
 * own interpolants (`AnimationAction._updateTime`), so `time` alone names the wrong frame there.
 */
export function clipTimeOf(action: AnimationAction): number {
  return isOnReturnPass(action) ? action.getClip().duration - action.time : action.time;
}

/**
 * Puts an action on a return pass back on a forward pass, at the clip time it stands on.
 * `AnimationPlayer::play` starts every playback forward (`animation_player.cpp:509`), and a seek or
 * a new loop reads `time` as a forward time. An action on a forward pass stays as it is.
 */
export function startForwardPass(action: AnimationAction): void {
  if (!isOnReturnPass(action)) return;
  const time = clipTimeOf(action);
  action.reset();
  action.time = time;
}
