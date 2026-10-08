import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { registerVisibilityInstance, type VisibilityInstance } from './visibilityScene';
import { fireSceneRender } from '../testing/fireSceneRender';
import {
  NO_VISIBILITY_RANGE,
  VisibilityRangeFadeMode,
  type VisibilityRange,
} from '../../godot/visibilityRange';

/** A camera on +Z at `distance` from the origin, looking at it, or away from it. */
function cameraAt(distance: number, isLookingAway = false): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
  camera.position.set(0, 0, distance);
  if (isLookingAway) camera.rotation.y = Math.PI;
  camera.updateMatrixWorld(true);
  return camera;
}

interface Applied {
  isVisible: boolean;
  fade: number;
  isCanvasRender: boolean;
}

/** An instance whose world AABB is a unit cube about `centre`, recording the last result. */
function instanceAt(
  range: Partial<VisibilityRange>,
  {
    path = null,
    parentPath = null,
    centre = new THREE.Vector3(),
  }: Partial<{
    path: string | null;
    parentPath: string | null;
    centre: THREE.Vector3;
  }> = {}
): VisibilityInstance & { last: Applied | null } {
  return {
    path,
    parentPath,
    range: { ...NO_VISIBILITY_RANGE, ...range },
    last: null,
    worldBox(target) {
      target.setFromCenterAndSize(centre, new THREE.Vector3(1, 1, 1));
    },
    apply(isVisible, fade, isCanvasRender) {
      this.last = { isVisible, fade, isCanvasRender };
    },
  };
}

describe('registerVisibilityInstance', () => {
  it('shows an instance inside its range', () => {
    const scene = new THREE.Scene();
    const instance = instanceAt({ end: 20 });
    registerVisibilityInstance(scene, instance);
    fireSceneRender(scene, cameraAt(11));
    expect(instance.last).toEqual({ isVisible: true, fade: 1, isCanvasRender: true });
  });

  it('hides an instance past its end', () => {
    const scene = new THREE.Scene();
    const instance = instanceAt({ end: 10 });
    registerVisibilityInstance(scene, instance);
    fireSceneRender(scene, cameraAt(11));
    expect(instance.last?.isVisible).toBe(false);
  });

  it('reports a render into a target as no canvas render', () => {
    const scene = new THREE.Scene();
    const instance = instanceAt({ end: 20 });
    registerVisibilityInstance(scene, instance);
    fireSceneRender(scene, cameraAt(11), new THREE.WebGLRenderTarget(1, 1));
    expect(instance.last?.isCanvasRender).toBe(false);
  });

  it('shows an instance with no range and no parent without measuring it', () => {
    const scene = new THREE.Scene();
    const instance = instanceAt({});
    const worldBox = vi.spyOn(instance, 'worldBox');
    registerVisibilityInstance(scene, instance);
    fireSceneRender(scene, cameraAt(11));
    expect([instance.last?.isVisible, worldBox.mock.calls.length]).toEqual([true, 0]);
  });

  it('keeps the hysteresis state of each camera apart', () => {
    // DISABLED, end 10 and margin 2: a hidden instance shows inside 8 and a shown one holds to 12.
    const scene = new THREE.Scene();
    const instance = instanceAt({ end: 10, endMargin: 2 });
    registerVisibilityInstance(scene, instance);
    const near = cameraAt(7);
    const far = cameraAt(11);
    fireSceneRender(scene, near);
    fireSceneRender(scene, far);
    expect(instance.last?.isVisible).toBe(false);
  });

  it('keeps the state of an instance out of view, as Godot checks only an instance in view', () => {
    const scene = new THREE.Scene();
    const instance = instanceAt({ end: 10, endMargin: 2 });
    registerVisibilityInstance(scene, instance);
    const camera = cameraAt(7);
    fireSceneRender(scene, camera);
    // Past the outer edge, but turned away: the shown state stands.
    camera.position.z = 13;
    camera.rotation.y = Math.PI;
    camera.updateMatrixWorld(true);
    fireSceneRender(scene, camera);
    // Turned back at 11, inside the outer edge, so the instance still shows.
    camera.position.z = 11;
    camera.rotation.y = 0;
    camera.updateMatrixWorld(true);
    fireSceneRender(scene, camera);
    expect(instance.last?.isVisible).toBe(true);
  });

  it('hides an instance out of view', () => {
    const scene = new THREE.Scene();
    const instance = instanceAt({ end: 20 });
    registerVisibilityInstance(scene, instance);
    fireSceneRender(scene, cameraAt(11, true));
    expect(instance.last?.isVisible).toBe(false);
  });

  it('hides the dependant of a visibility parent past its end', () => {
    const scene = new THREE.Scene();
    const proxy = instanceAt(
      { end: 10, fadeMode: VisibilityRangeFadeMode.DEPENDENCIES },
      { path: 'Root/Proxy' }
    );
    const detail = instanceAt({}, { path: 'Root/Proxy/Detail', parentPath: 'Root/Proxy' });
    registerVisibilityInstance(scene, proxy);
    registerVisibilityInstance(scene, detail);
    fireSceneRender(scene, cameraAt(11));
    expect([proxy.last?.isVisible, detail.last?.isVisible]).toEqual([false, false]);
  });

  it('hides the dependant of a visibility parent inside its range', () => {
    const scene = new THREE.Scene();
    const proxy = instanceAt({ begin: 5 }, { path: 'Root/Proxy' });
    const detail = instanceAt({}, { path: 'Root/Detail', parentPath: 'Root/Proxy' });
    registerVisibilityInstance(scene, proxy);
    registerVisibilityInstance(scene, detail);
    fireSceneRender(scene, cameraAt(11));
    expect([proxy.last?.isVisible, detail.last?.isVisible]).toEqual([true, false]);
  });

  it('shows the dependant of a visibility parent short of its begin', () => {
    const scene = new THREE.Scene();
    const proxy = instanceAt({ begin: 12 }, { path: 'Root/Proxy' });
    const detail = instanceAt({}, { path: 'Root/Detail', parentPath: 'Root/Proxy' });
    registerVisibilityInstance(scene, proxy);
    registerVisibilityInstance(scene, detail);
    fireSceneRender(scene, cameraAt(11));
    expect([proxy.last?.isVisible, detail.last?.isVisible]).toEqual([false, true]);
  });

  it('treats a visibility parent path that names no instance as none', () => {
    const scene = new THREE.Scene();
    const detail = instanceAt({}, { path: 'Root/Detail', parentPath: 'Root/Missing' });
    registerVisibilityInstance(scene, detail);
    fireSceneRender(scene, cameraAt(11));
    expect(detail.last?.isVisible).toBe(true);
  });

  it('restores the scene hook once the last instance leaves', () => {
    const scene = new THREE.Scene();
    const original = scene.onBeforeRender;
    const unregister = registerVisibilityInstance(scene, instanceAt({ end: 10 }));
    unregister();
    expect(scene.onBeforeRender).toBe(original);
  });
});
