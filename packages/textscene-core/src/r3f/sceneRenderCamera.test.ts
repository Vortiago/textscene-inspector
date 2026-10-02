import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { observeSceneCamera } from './sceneRenderCamera';

/** What `WebGLRenderer.render` does to a scene, minus the rendering. */
function fireRender(scene: THREE.Scene, camera: THREE.Camera) {
  scene.onBeforeRender(
    null as unknown as THREE.WebGLRenderer,
    scene,
    camera,
    null as unknown as THREE.BufferGeometry,
    null as unknown as THREE.Material,
    null as unknown as THREE.Group
  );
}

describe('observeSceneCamera', () => {
  it('reports the camera each render uses', () => {
    const scene = new THREE.Scene();
    const seen: THREE.Camera[] = [];
    observeSceneCamera(scene, (camera) => seen.push(camera));

    const a = new THREE.OrthographicCamera();
    const b = new THREE.PerspectiveCamera();
    fireRender(scene, a);
    fireRender(scene, b);

    expect(seen).toEqual([a, b]);
  });

  it('chains rather than replaces, so several backgrounds share one scene', () => {
    const scene = new THREE.Scene();
    const original = vi.fn();
    scene.onBeforeRender = original;

    const first = vi.fn();
    const second = vi.fn();
    observeSceneCamera(scene, first);
    observeSceneCamera(scene, second);

    fireRender(scene, new THREE.OrthographicCamera());
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

    fireRender(scene, new THREE.OrthographicCamera());
    expect(observer).not.toHaveBeenCalled();
  });
});
