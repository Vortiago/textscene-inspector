/** startAction and seekAction re-apply weight and timeScale on every play(), and clipTimeOf reads the time a loop samples. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { clipTimeOf, startAction, seekAction, startForwardPass } from './actionHelpers';

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

/** A playing action on a 1 s clip that slides `T` from x 0 to 1, with the object and the mixer that steps it. */
function playLooping(loop: THREE.AnimationActionLoopStyles) {
  const action = makeAction();
  action.setLoop(loop, Infinity);
  action.clampWhenFinished = true;
  action.play();
  const mixer = action.getMixer();
  return { action, mixer, target: mixer.getRoot() as THREE.Object3D };
}

describe('clipTimeOf', () => {
  it.each([
    ['LoopOnce', THREE.LoopOnce],
    ['LoopRepeat', THREE.LoopRepeat],
    ['LoopPingPong', THREE.LoopPingPong],
  ])('is the time %s samples the clip at, on every pass', (_name, loop) => {
    const { action, mixer, target } = playLooping(loop);
    for (let frame = 0; frame < 12; frame++) {
      mixer.update(0.3);
      // The track maps the clip time to x one to one, so x is the time THREE sampled.
      expect(clipTimeOf(action)).toBeCloseTo(target.position.x, 10);
    }
  });

  it('runs back on the return pass of a LoopPingPong, where `time` runs on forward', () => {
    const { action, mixer } = playLooping(THREE.LoopPingPong);
    mixer.update(1.2);
    expect(action.time).toBeCloseTo(0.2);
    expect(clipTimeOf(action)).toBeCloseTo(0.8);
  });

  it('is the time of an action that has not started', () => {
    const action = makeAction();
    action.setLoop(THREE.LoopPingPong, Infinity);
    action.time = 0.4;
    expect(clipTimeOf(action)).toBe(0.4);
  });
});

describe('startForwardPass', () => {
  it('plays forward from the clip time of a return pass', () => {
    const { action, mixer, target } = playLooping(THREE.LoopPingPong);
    mixer.update(1.2);
    startForwardPass(action);
    mixer.update(0.1);
    expect(target.position.x).toBeCloseTo(0.9);
  });

  it('samples a seek on a return pass at the time asked for', () => {
    const { action, mixer, target } = playLooping(THREE.LoopPingPong);
    mixer.update(1.2);
    startForwardPass(action);
    seekAction(action, 0.25);
    mixer.update(0);
    expect(target.position.x).toBeCloseTo(0.25);
  });

  it('leaves a forward pass as it stands', () => {
    const { action, mixer } = playLooping(THREE.LoopRepeat);
    mixer.update(1.2);
    startForwardPass(action);
    expect(action.time).toBeCloseTo(0.2);
    expect(action.isRunning()).toBe(true);
  });
});
