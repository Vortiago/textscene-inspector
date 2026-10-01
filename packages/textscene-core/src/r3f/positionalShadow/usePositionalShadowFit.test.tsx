/**
 * The hook as a light component mounts it. The test renderer draws nothing, so `renderThrough` plays
 * the part of `WebGLRenderer.render`, which calls `scene.onBeforeRender` first.
 */
import { describe, expect, it } from 'vitest';
import { useRef } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { usePositionalShadowFit } from './usePositionalShadowFit';

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function FittedLamp({ softShadowScale, isMounted = true }: { softShadowScale: number; isMounted?: boolean }) {
  const lightRef = useRef<THREE.PointLight | null>(null);
  usePositionalShadowFit(lightRef, softShadowScale);
  return isMounted ? <pointLight ref={lightRef} castShadow distance={8} position={[0, 0, -5]} /> : null;
}

function renderThrough(renderer: Renderer, camera: THREE.Camera): void {
  const scene = renderer.scene.instance as THREE.Scene;
  scene.updateMatrixWorld();
  camera.updateMatrixWorld();
  const beforeRender = scene.onBeforeRender as (...args: unknown[]) => void;
  beforeRender.call(scene, null, scene, camera, null);
}

function lamp(renderer: Renderer): THREE.PointLight {
  return renderer.scene.findByType('PointLight').instance as THREE.PointLight;
}

const camera = new THREE.PerspectiveCamera(90, 1, 0.05, 100);

describe('usePositionalShadowFit', () => {
  it('fits the light before each render of its scene', async () => {
    const renderer = await ReactThreeTestRenderer.create(<FittedLamp softShadowScale={2} />);
    renderThrough(renderer, camera);
    expect(lamp(renderer).shadow.mapSize.x).toBe(512);
    expect(lamp(renderer).shadow.radius).toBeCloseTo((4 / 1022) * 512, 12);
  });

  it('fits with the latest scale after a re-render', async () => {
    const renderer = await ReactThreeTestRenderer.create(<FittedLamp softShadowScale={2} />);
    await renderer.update(<FittedLamp softShadowScale={8} />);
    renderThrough(renderer, camera);
    expect(lamp(renderer).shadow.radius).toBeCloseTo((16 / 1022) * 512, 12);
  });

  it('fits nothing while the ref holds no light (edge case)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <FittedLamp softShadowScale={2} isMounted={false} />
    );
    expect(() => renderThrough(renderer, camera)).not.toThrow();
  });

  it('stops fitting once unmounted (error case)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<FittedLamp softShadowScale={2} />);
    const scene = renderer.scene.instance as THREE.Scene;
    await renderer.unmount();
    expect(scene.onBeforeRender).toBe(THREE.Object3D.prototype.onBeforeRender);
  });
});
