/** startAction and seekAction re-apply weight and timeScale on every play(). */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { startAction, seekAction } from './actionHelpers';

function makeAction(weight = 1, timeScale = 1): THREE.AnimationAction {
  const target = new THREE.Object3D();
  target.name = 'T';
  const clip = new THREE.AnimationClip('c', 1, [
    new THREE.VectorKeyframeTrack('T.position', [0, 1], [0, 0, 0, 1, 0, 0]),
  ]);
  const mixer = new THREE.AnimationMixer(target);
  const action = mixer.clipAction(clip);
  action.setEffectiveWeight(weight);
  action.setEffectiveTimeScale(timeScale);
  return action;
}

describe('startAction', () => {
  it('starts the action as playing (not paused)', () => {
    const action = makeAction();
    startAction(action);
    expect(action.isRunning()).toBe(true);
    expect(action.paused).toBe(false);
  });

  it('applies default weight 1 and timeScale 1 when no opts given', () => {
    const action = makeAction(0.5, 0.5);
    startAction(action);
    expect(action.getEffectiveWeight()).toBe(1);
    expect(action.getEffectiveTimeScale()).toBe(1);
  });

  it('applies explicit weight and timeScale from opts', () => {
    const action = makeAction();
    startAction(action, { weight: 0.75, timeScale: 2 });
    expect(action.getEffectiveWeight()).toBe(0.75);
    expect(action.getEffectiveTimeScale()).toBe(2);
  });

  it('enables the action', () => {
    const action = makeAction();
    action.enabled = false;
    startAction(action);
    expect(action.enabled).toBe(true);
  });
});

describe('seekAction', () => {
  it('leaves the action paused at the given time', () => {
    const action = makeAction();
    seekAction(action, 0.5);
    expect(action.paused).toBe(true);
    expect(action.time).toBe(0.5);
  });

  it('re-applies weight and timeScale so a fresh play()-ed action does not over-blend', () => {
    const action = makeAction(0.25, 0.5);
    // A fresh play() would reset to weight 1; seekAction must re-apply the authored values.
    seekAction(action, 0.3, { weight: 0.25, timeScale: 0.5 });
    expect(action.getEffectiveWeight()).toBe(0.25);
    expect(action.getEffectiveTimeScale()).toBe(0.5);
  });

  it('defaults to weight 1 and timeScale 1 when no opts given', () => {
    const action = makeAction(0.3, 0.3);
    seekAction(action, 0.0);
    expect(action.getEffectiveWeight()).toBe(1);
    expect(action.getEffectiveTimeScale()).toBe(1);
  });

  it('enables the action', () => {
    const action = makeAction();
    action.enabled = false;
    seekAction(action, 0.1);
    expect(action.enabled).toBe(true);
  });
});
