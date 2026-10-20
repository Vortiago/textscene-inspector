/**
 * The loop mode Godot's importer gives a GLB-embedded clip. The GLB processor writes it on the
 * cached template's clip, and `GLBSceneRoot` reads it to configure the clip's action.
 */

import type * as THREE from 'three';
import { AnimationLoopMode } from '../../../godot/scene/animation.js';

const LOOP_MODE_KEY = 'godotLoopMode';

export function setImportedLoopMode(clip: THREE.AnimationClip, loopMode: number): void {
  clip.userData[LOOP_MODE_KEY] = loopMode;
}

/** LOOP_NONE for a clip the processor never set, the `Animation` default. */
export function importedLoopMode(clip: THREE.AnimationClip): number {
  const loopMode: unknown = clip.userData[LOOP_MODE_KEY];
  return typeof loopMode === 'number' ? loopMode : AnimationLoopMode.NONE;
}
