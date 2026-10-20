/**
 * The preview loop override as a THREE action's loop, shared by every driver:
 * 'once' is one clamped pass, 'loop' repeats, and 'auto' keeps the authored
 * setting (a Godot `loop_mode` through `loopSettingsFor`).
 */
import {
  LoopOnce,
  LoopPingPong,
  LoopRepeat,
  type AnimationAction,
  type AnimationActionLoopStyles,
} from 'three';
import { AnimationLoopMode } from '../../godot/scene/animation.js';
import type { LoopOverride } from '../contexts/AnimationTransportContext.js';

export interface ActionLoopSettings {
  loop: AnimationActionLoopStyles;
  repetitions: number;
  clampWhenFinished: boolean;
}

/** 'once': a single pass, clamped at the last frame instead of snapping back. */
const LOOP_ONCE_SETTINGS: ActionLoopSettings = Object.freeze({
  loop: LoopOnce,
  repetitions: 1,
  clampWhenFinished: true,
});

/** 'loop', and a LOOP_LINEAR clip: infinite linear repeat. */
const LOOP_REPEAT_SETTINGS: ActionLoopSettings = Object.freeze({
  loop: LoopRepeat,
  repetitions: Infinity,
  clampWhenFinished: false,
});

/** LOOP_PINGPONG: infinite bounce between the first and last key. */
const LOOP_PINGPONG_SETTINGS: ActionLoopSettings = Object.freeze({
  loop: LoopPingPong,
  repetitions: Infinity,
  clampWhenFinished: false,
});

/**
 * Maps a Godot `Animation::LoopMode` to THREE action loop settings. LOOP_PINGPONG bounces forward
 * and backward as Godot's does. A value outside the enum plays once, as LOOP_NONE.
 */
export function loopSettingsFor(loopMode: number): ActionLoopSettings {
  switch (loopMode) {
    case AnimationLoopMode.PINGPONG:
      return LOOP_PINGPONG_SETTINGS;
    case AnimationLoopMode.LINEAR:
      return LOOP_REPEAT_SETTINGS;
    default:
      return LOOP_ONCE_SETTINGS;
  }
}

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
