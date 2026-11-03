import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import type { OpaqueSentinel } from '../opaqueSentinel';
import { SceneReflections, type ReflectionSettings } from './sceneReflections';
import { SSR_STATE, ssrState } from './ssrUniforms';

const SETTINGS: ReflectionSettings = {
  ssr: { maxSteps: 64, fadeIn: 0.15, fadeOut: 2, depthTolerance: 0.2 },
  isHalfSize: true,
};

/** A render of one world buffer whose opaque list has traced, as `beginOpaque` leaves the state. */
function tracedRender() {
  const target = new THREE.WebGLRenderTarget(4, 4);
  const renderer = {} as unknown as THREE.WebGLRenderer;
  const reflections = new SceneReflections(
    renderer,
    () => SETTINGS,
    () => {}
  );
  const camera = new THREE.PerspectiveCamera();
  reflections.begin(camera, target);
  ssrState[SSR_STATE.showsReflection] = 1;
  return { renderer, reflections, camera };
}

function reach(sentinel: OpaqueSentinel, renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
  const { mesh } = sentinel;
  mesh.onBeforeRender(renderer, new THREE.Scene(), camera, mesh.geometry, mesh.material, null!);
}

afterEach(() => {
  ssrState[SSR_STATE.showsReflection] = 0;
});

describe('SceneReflections', () => {
  it("shows no reflection after the opaque list, as Godot's alpha pass reads none", () => {
    const { renderer, reflections, camera } = tracedRender();

    reach(reflections.lastSentinel, renderer, camera);

    expect(ssrState[SSR_STATE.showsReflection]).toBe(0);
  });

  it('draws its last sentinel after every other surface of the opaque list', () => {
    const { reflections } = tracedRender();

    expect(reflections.lastSentinel.renderOrder).toBe(Number.MAX_SAFE_INTEGER);
  });
});
