/**
 * Preview loop override → THREE action loop config, shared by every
 * transport driver so the override semantics cannot drift between slices:
 * 'once' forces a single clamped pass, 'loop' an infinite repeat, 'auto'
 * keeps the driver's authored settings (Godot `loop_mode` for
 * AnimationPlayer clips via its slice's `loopSettingsFor`; a GLB clip's
 * default infinite repeat).
 */
import { LoopOnce, LoopRepeat, type AnimationAction, type AnimationActionLoopStyles } from 'three';
import type { LoopOverride } from '../contexts/AnimationTransportContext.js';

export interface ActionLoopSettings {
  loop: AnimationActionLoopStyles;
  repetitions: number;
  clampWhenFinished: boolean;
}

/** 'once': a single pass, clamped at the last frame instead of snapping back. */
export const LOOP_ONCE_SETTINGS: ActionLoopSettings = Object.freeze({
  loop: LoopOnce,
  repetitions: 1,
  clampWhenFinished: true,
});

/** 'loop' (and a GLB clip's authored default): infinite linear repeat. */
export const LOOP_REPEAT_SETTINGS: ActionLoopSettings = Object.freeze({
  loop: LoopRepeat,
  repetitions: Infinity,
  clampWhenFinished: false,
});

export function applyLoopOverride(
  action: AnimationAction,
  override: LoopOverride,
  authored: ActionLoopSettings
): void {
  const settings =
    override === 'once' ? LOOP_ONCE_SETTINGS : override === 'loop' ? LOOP_REPEAT_SETTINGS : authored;
  action.setLoop(settings.loop, settings.repetitions);
  action.clampWhenFinished = settings.clampWhenFinished;
}

/**
 * Whether a clip repeats under the override — for drivers with no THREE
 * action to configure (AnimatedSprite2D steps frames from a playhead
 * itself). Same semantics as `applyLoopOverride`, collapsed to a boolean:
 * a non-repeating clip holds its last frame (the clamp behavior).
 */
export function loopsUnderOverride(override: LoopOverride, authoredLoop: boolean): boolean {
  return override === 'auto' ? authoredLoop : override === 'loop';
}
