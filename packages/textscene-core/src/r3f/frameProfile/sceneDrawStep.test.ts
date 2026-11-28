import { describe, expect, it } from 'vitest';
import { fireSceneRenderEnd } from '../testing/fireSceneRender';
import * as THREE from 'three';
import { withFrameStep, countShadowDraws } from './frameProfile';
import { cpuOnlyRenderer, profiledWindow, stepCpuMs } from './frameProfile.testkit';
import { timeSceneDraws } from './sceneDrawStep';

function setup(countsSurfaces = true) {
  const renderer = cpuOnlyRenderer();
  const scene = new THREE.Scene();
  const canvasCamera = new THREE.PerspectiveCamera();
  const clock = { time: 0 };
  renderer.render = (drawn, camera) => {
    clock.time += 2;
    fireSceneRenderEnd(drawn, camera);
  };
  const stop = timeSceneDraws(renderer, scene, () => canvasCamera, countsSurfaces);
  const draw = (camera: THREE.Camera) => renderer.render(scene, camera);
  const window = (frame: () => void) => profiledWindow(renderer, () => clock.time, frame);
  return { renderer, scene, canvasCamera, draw, stop, window, clock };
}

function addBox(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const geometry = new THREE.BoxGeometry();
  const object = new THREE.Mesh(geometry);
  scene.add(object);
  renderer.renderLists.get(scene, 0).opaque.push({ object, geometry, group: null } as never);
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
      withFrameStep(renderer, '2D lights', () => {
        draw(canvasCamera);
      });
    });
    expect(stepCpuMs(stats)).toEqual([
      ['2D lights', 2],
      ['Other', 0],
    ]);
  });

  it("times the compositor's scene pass as the Scene draw step", () => {
    const { renderer, canvasCamera, draw, window } = setup();
    const stats = window(() => {
      withFrameStep(renderer, 'Compositor', () => {
        draw(canvasCamera);
      });
    });
    expect(stepCpuMs(stats)).toEqual([
      ['Scene draw', 2],
      ['Compositor', 0],
      ['Other', 0],
    ]);
  });

  it('closes the scene draw when the renderer throws inside the compositor', () => {
    const { renderer, scene, canvasCamera, draw, clock, window } = setup();
    addBox(renderer, scene);
    scene.onAfterRender = () => {
      throw new Error('draw failed');
    };
    const stats = window(() => {
      withFrameStep(renderer, 'Compositor', () => {
        expect(() => draw(canvasCamera)).toThrow('draw failed');
        clock.time++;
      });
      clock.time++;
    });
    expect(stats).toMatchObject({ objectsPerFrame: 0, primitivesPerFrame: 0 });
    expect(stepCpuMs(stats)).toEqual([
      ['Scene draw', 2],
      ['Compositor', 1],
      ['Other', 1],
    ]);
  });

  it('times nothing once stopped (error case)', () => {
    const { canvasCamera, draw, stop, window } = setup();
    stop();
    expect(stepCpuMs(window(() => draw(canvasCamera)))).toEqual([['Other', 2]]);
  });
});

describe('the objects and primitives a canvas draw counts', () => {
  /** The setup with a box in the render list, and a shadow pass that makes `shadowDraws` draw calls. */
  function withBox(countsSurfaces = true) {
    const context = setup(countsSurfaces);
    const { renderer, canvasCamera } = context;
    addBox(renderer, context.scene);
    const shadowPass = (shadowDraws: number) =>
      countShadowDraws(renderer, () => (renderer.info.render.calls += shadowDraws));
    const drawWithShadows = (shadowDraws: number) => {
      context.scene.onAfterRender = () => shadowPass(shadowDraws);
      context.draw(canvasCamera);
    };
    return { ...context, shadowPass, drawWithShadows };
  }

  it("counts the surfaces of the canvas draw's list", () => {
    const { canvasCamera, draw, window } = withBox();
    expect(window(() => draw(canvasCamera))).toMatchObject({ objectsPerFrame: 1, primitivesPerFrame: 12 });
  });

  it('counts nothing of a render through another camera, such as a probe capture', () => {
    const { draw, window } = withBox();
    expect(window(() => draw(new THREE.PerspectiveCamera()))).toMatchObject({
      objectsPerFrame: 0,
      primitivesPerFrame: 0,
    });
  });

  it("counts each draw of the canvas draw's shadow pass as an object, and none of its primitives", () => {
    const { drawWithShadows, window } = withBox();
    expect(window(() => drawWithShadows(6))).toMatchObject({ objectsPerFrame: 7, primitivesPerFrame: 12 });
  });

  it('counts nothing of a 2D canvas draw, which has no counter (edge case)', () => {
    const { canvasCamera, draw, window } = withBox(false);
    expect(window(() => draw(canvasCamera))).toMatchObject({ objectsPerFrame: 0, primitivesPerFrame: 0 });
  });

  it("counts no draw of another view's shadow pass, such as a sub-viewport's (edge case)", () => {
    const { renderer, shadowPass, window } = withBox();
    const stats = window(() => {
      withFrameStep(renderer, 'SubViewports', () => {
        shadowPass(6);
      });
    });
    expect(stats.objectsPerFrame).toBe(0);
  });
});
