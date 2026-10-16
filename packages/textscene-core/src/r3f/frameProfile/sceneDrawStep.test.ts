import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { fireSceneRender, fireSceneRenderEnd } from '../testing/fireSceneRender';
import { beginStep, endStep } from './frameProfile';
import { CPU_ONLY_CONTEXT, profiledWindow, stepCpuMs } from './frameProfile.testkit';
import { timeSceneDraws } from './sceneDrawStep';

function setup() {
  const renderer = { getContext: () => CPU_ONLY_CONTEXT } as unknown as THREE.WebGLRenderer;
  const scene = new THREE.Scene();
  const canvasCamera = new THREE.PerspectiveCamera();
  const clock = { time: 0 };
  /** A render of the scene through `camera` that takes 2 ms. */
  const draw = (camera: THREE.Camera) => {
    fireSceneRender(scene, camera);
    clock.time += 2;
    fireSceneRenderEnd(scene, camera);
  };
  const stop = timeSceneDraws(renderer, scene, () => canvasCamera);
  const window = (frame: () => void) => profiledWindow(renderer, () => clock.time, frame);
  return { renderer, canvasCamera, draw, stop, window };
}

describe('timeSceneDraws', () => {
  it("times a render through the canvas's camera as the Scene draw step", () => {
    const { canvasCamera, draw, window } = setup();
    expect(stepCpuMs(window(() => draw(canvasCamera)))).toEqual([
      ['Scene draw', 2],
      ['Other', 0],
    ]);
  });

  it("leaves a render through another camera, such as a probe's capture, out of the step", () => {
    const { draw, window } = setup();
    expect(stepCpuMs(window(() => draw(new THREE.PerspectiveCamera())))).toEqual([['Other', 2]]);
  });

  it('leaves a render inside another step, such as the 2D light pass, to that step (edge case)', () => {
    const { renderer, canvasCamera, draw, window } = setup();
    const stats = window(() => {
      beginStep(renderer, '2D lights');
      draw(canvasCamera);
      endStep(renderer, '2D lights');
    });
    expect(stepCpuMs(stats)).toEqual([
      ['2D lights', 2],
      ['Other', 0],
    ]);
  });

  it("times the compositor's scene pass as the Scene draw step", () => {
    const { renderer, canvasCamera, draw, window } = setup();
    const stats = window(() => {
      beginStep(renderer, 'Compositor');
      draw(canvasCamera);
      endStep(renderer, 'Compositor');
    });
    expect(stepCpuMs(stats)).toEqual([
      ['Scene draw', 2],
      ['Compositor', 0],
      ['Other', 0],
    ]);
  });

  it('times nothing once stopped (error case)', () => {
    const { canvasCamera, draw, stop, window } = setup();
    stop();
    expect(stepCpuMs(window(() => draw(canvasCamera)))).toEqual([['Other', 2]]);
  });
});
