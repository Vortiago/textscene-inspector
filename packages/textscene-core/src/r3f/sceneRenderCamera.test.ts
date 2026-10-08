import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { isViewportPass, observeSceneCamera } from './sceneRenderCamera';
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
  const storeCamera = new THREE.OrthographicCamera();

  it('is true for an orthographic camera other than the store camera', () => {
    expect(isViewportPass(new THREE.OrthographicCamera(), storeCamera)).toBe(true);
  });

  it('is false for the store camera, which draws the 2D stage', () => {
    expect(isViewportPass(storeCamera, storeCamera)).toBe(false);
  });

  it('is false for a perspective camera, which frames no canvas', () => {
    expect(isViewportPass(new THREE.PerspectiveCamera(), storeCamera)).toBe(false);
  });
});
