import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createViewportCanvasCamera, isViewportPass, observeSceneCamera } from './sceneRenderCamera';
import { fireSceneRender } from './testing/fireSceneRender';

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
