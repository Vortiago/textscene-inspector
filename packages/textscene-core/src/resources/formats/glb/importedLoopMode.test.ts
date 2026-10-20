import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AnimationLoopMode } from '../../../godot/scene/animation';
import { importedLoopMode, setImportedLoopMode } from './importedLoopMode';

describe('importedLoopMode', () => {
  it('reads back the mode the processor set', () => {
    const clip = new THREE.AnimationClip('walk', 1, []);
    setImportedLoopMode(clip, AnimationLoopMode.PINGPONG);
    expect(importedLoopMode(clip)).toBe(AnimationLoopMode.PINGPONG);
  });

  it('reads a clip nobody set as LOOP_NONE, the Animation default', () => {
    expect(importedLoopMode(new THREE.AnimationClip('walk', 1, []))).toBe(AnimationLoopMode.NONE);
  });

  it('survives a clip clone', () => {
    const clip = new THREE.AnimationClip('walk', 1, []);
    setImportedLoopMode(clip, AnimationLoopMode.LINEAR);
    expect(importedLoopMode(clip.clone())).toBe(AnimationLoopMode.LINEAR);
  });
});
