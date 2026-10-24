import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import {
  cameraDistance,
  createViewportCanvasCamera,
  isViewportPass,
  observeSceneCamera,
  observeSceneCull,
  observeSceneRenderEnd,
} from './sceneRenderCamera';
import { applyOrthoFrame, orthoFrameForSize } from '../nodes/viewport/subviewport/offscreenViewport';
import { fireSceneRender, fireSceneRenderEnd } from './testing/fireSceneRender';

describe('observeSceneCamera', () => {
  it('reports the camera each render uses', () => {
    const scene = new THREE.Scene();
    const seen: THREE.Camera[] = [];
    observeSceneCamera(scene, (camera) => seen.push(camera));

    const a = new THREE.OrthographicCamera();
    const b = new THREE.PerspectiveCamera();
    fireSceneRender(scene, a);
    fireSceneRender(scene, b);

    expect(seen).toEqual([a, b]);
  });

  it('reports the render target each render draws into, null for the canvas', () => {
    const scene = new THREE.Scene();
    const seen: (THREE.WebGLRenderTarget | null)[] = [];
    observeSceneCamera(scene, (_camera, target) => seen.push(target));

    const target = new THREE.WebGLRenderTarget(4, 4);
    fireSceneRender(scene, new THREE.OrthographicCamera(), target);
    fireSceneRender(scene, new THREE.OrthographicCamera());

    expect(seen).toEqual([target, null]);
  });

  it('chains rather than replaces, so several backgrounds share one scene', () => {
    const scene = new THREE.Scene();
    const original = vi.fn();
    scene.onBeforeRender = original;

    const first = vi.fn();
    const second = vi.fn();
    observeSceneCamera(scene, first);
    observeSceneCamera(scene, second);

    fireSceneRender(scene, new THREE.OrthographicCamera());
    expect(original).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('runs a cull after every other observer, whatever order they came in', () => {
    const scene = new THREE.Scene();
    const order: string[] = [];
    observeSceneCull(scene, () => order.push('cull'));
    observeSceneCamera(scene, () => order.push('fit'));
    fireSceneRender(scene, new THREE.OrthographicCamera());
    expect(order).toEqual(['fit', 'cull']);
  });

  it('keeps the hook while a cull still observes', () => {
    const scene = new THREE.Scene();
    const original = scene.onBeforeRender;
    observeSceneCull(scene, vi.fn());
    observeSceneCamera(scene, vi.fn())();
    expect(scene.onBeforeRender).not.toBe(original);
  });

  it('restores the original hook once the last observer disposes', () => {
    const scene = new THREE.Scene();
    const original = scene.onBeforeRender;

    const disposeFirst = observeSceneCamera(scene, vi.fn());
    const disposeSecond = observeSceneCamera(scene, vi.fn());
    expect(scene.onBeforeRender).not.toBe(original);

    disposeFirst();
    expect(scene.onBeforeRender).not.toBe(original);
    disposeSecond();
    expect(scene.onBeforeRender).toBe(original);
  });

  it('is safe to dispose twice', () => {
    const scene = new THREE.Scene();
    const observer = vi.fn();
    const dispose = observeSceneCamera(scene, observer);
    dispose();
    expect(() => dispose()).not.toThrow();

    fireSceneRender(scene, new THREE.OrthographicCamera());
    expect(observer).not.toHaveBeenCalled();
  });
});

describe('observeSceneRenderEnd', () => {
  it('reports the end of each render, after the original hook', () => {
    const scene = new THREE.Scene();
    const order: string[] = [];
    scene.onAfterRender = () => order.push('original');
    observeSceneRenderEnd(scene, () => order.push('end'));

    fireSceneRenderEnd(scene, new THREE.OrthographicCamera());

    expect(order).toEqual(['original', 'end']);
  });

  it('reports no start of a render (edge case)', () => {
    const scene = new THREE.Scene();
    const finisher = vi.fn();
    observeSceneRenderEnd(scene, finisher);

    fireSceneRender(scene, new THREE.OrthographicCamera());

    expect(finisher).not.toHaveBeenCalled();
  });

  it('restores both original hooks once the last observer of either kind disposes', () => {
    const scene = new THREE.Scene();
    const { onBeforeRender, onAfterRender } = scene;
    const disposeEnd = observeSceneRenderEnd(scene, vi.fn());
    const disposeCamera = observeSceneCamera(scene, vi.fn());

    disposeCamera();
    expect(scene.onAfterRender).not.toBe(onAfterRender);
    disposeEnd();
    expect(scene.onBeforeRender).toBe(onBeforeRender);
    expect(scene.onAfterRender).toBe(onAfterRender);
  });
});

describe('createViewportCanvasCamera', () => {
  it("maps the canvas top to NDC y = -1, as the root canvas's camera does", () => {
    const camera = createViewportCanvasCamera();
    applyOrthoFrame(camera, orthoFrameForSize({ x: 100, y: 50 }));
    camera.updateMatrixWorld(true);

    const canvasTop = new THREE.Vector3(50, 0, 0).project(camera);
    const canvasBottom = new THREE.Vector3(50, -50, 0).project(camera);

    expect([canvasTop.y, canvasBottom.y]).toEqual([-1, 1]);
  });
});

describe('isViewportPass', () => {
  it("is true for a sub-viewport's canvas camera", () => {
    expect(isViewportPass(createViewportCanvasCamera())).toBe(true);
  });

  it('is false for any other orthographic camera, such as a Camera3D in a 3D sub-viewport', () => {
    expect(isViewportPass(new THREE.OrthographicCamera())).toBe(false);
  });

  it('is false for a perspective camera, which frames no canvas', () => {
    expect(isViewportPass(new THREE.PerspectiveCamera())).toBe(false);
  });
});

describe('cameraDistance', () => {
  it("measures from the camera to the object's world origin", () => {
    const parent = new THREE.Group();
    parent.position.set(0, 3, 0);
    const object = new THREE.Object3D();
    object.position.set(4, 0, 0);
    parent.add(object);
    parent.updateMatrixWorld();
    const camera = new THREE.PerspectiveCamera();
    camera.updateMatrixWorld();

    expect(cameraDistance(object, camera)).toBeCloseTo(5, 10);
  });

  it('measures zero for an object at the camera', () => {
    const object = new THREE.Object3D();
    object.updateMatrixWorld();
    const camera = new THREE.PerspectiveCamera();
    camera.updateMatrixWorld();

    expect(cameraDistance(object, camera)).toBe(0);
  });
});
