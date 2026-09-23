/**
 * The preview loop override as a THREE action's loop, shared by every driver:
 * 'once' is one clamped pass, 'loop' repeats, and 'auto' keeps the authored
 * setting (Godot `loop_mode` through `loopSettingsFor`, or a GLB's repeat).
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
 * Whether a clip repeats under the override, for a driver with no THREE action,
 * such as AnimatedSprite2D. A clip that does not repeat holds its last frame.
 */
export function loopsUnderOverride(override: LoopOverride, authoredLoop: boolean): boolean {
  return override === 'auto' ? authoredLoop : override === 'loop';
}
