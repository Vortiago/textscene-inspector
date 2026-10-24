/**
 * A scene writes its world's factor for each render it takes and puts it back when the render ends,
 * so a scene with no exposure never draws with another's.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { EMISSION_EXPOSURE } from './emissionExposure';
import { exposureOfScene, useSceneExposure } from './sceneExposure';
import { fireSceneRender, fireSceneRenderEnd } from '../testing/fireSceneRender';

function Exposed({ factor }: { factor: number }) {
  useSceneExposure(factor);
  return null;
}

const CAMERA = new THREE.PerspectiveCamera();

function sceneOf(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>): THREE.Scene {
  return renderer.scene.instance as THREE.Scene;
}

/** Mounts `factor` and answers the scene its renders are fired on. */
async function mount(factor: number | null) {
  const renderer = await ReactThreeTestRenderer.create(factor === null ? null : <Exposed factor={factor} />);
  return { renderer, scene: sceneOf(renderer) };
}

describe('useSceneExposure', () => {
  it('writes the factor into the emission uniform for a render of the scene', async () => {
    const { scene } = await mount(2);
    fireSceneRender(scene, CAMERA);
    expect(EMISSION_EXPOSURE[0]).toBe(2);
  });

  it('puts the factor 1 back when the render ends', async () => {
    const { scene } = await mount(2);
    fireSceneRender(scene, CAMERA);
    fireSceneRenderEnd(scene, CAMERA);
    expect(EMISSION_EXPOSURE[0]).toBe(1);
  });

  it('writes a factor of 0, which darkens the emission to nothing (edge case)', async () => {
    const { scene } = await mount(0);
    fireSceneRender(scene, CAMERA);
    expect(EMISSION_EXPOSURE[0]).toBe(0);
  });

  it('writes a new factor from the next render on', async () => {
    const { renderer, scene } = await mount(2);
    await renderer.update(<Exposed factor={6} />);
    fireSceneRender(scene, CAMERA);
    expect(EMISSION_EXPOSURE[0]).toBe(6);
  });

  it('writes nothing for a scene that holds no exposure', async () => {
    const { scene } = await mount(null);
    EMISSION_EXPOSURE[0] = 1;
    fireSceneRender(scene, CAMERA);
    expect(EMISSION_EXPOSURE[0]).toBe(1);
  });

  it('stops writing when the world unmounts', async () => {
    const { renderer, scene } = await mount(2);
    await renderer.update(null);
    fireSceneRender(scene, CAMERA);
    expect(EMISSION_EXPOSURE[0]).toBe(1);
  });

  it('answers the factor of a scene for a probe capture to compare', async () => {
    const { scene } = await mount(3);
    expect(exposureOfScene(scene)).toBe(3);
  });

  it('answers 1 for a scene with no exposure', async () => {
    const { scene } = await mount(null);
    expect(exposureOfScene(scene)).toBe(1);
  });
});
