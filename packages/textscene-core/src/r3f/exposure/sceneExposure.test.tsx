/**
 * A scene writes its world's factor for each render it takes and puts it back when the render ends,
 * so a scene with no exposure never draws with another's.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { EMISSION_EXPOSURE } from './emissionExposure';
import {
  drawAtExposure,
  drawnExposureRatio,
  exposureOfScene,
  registerExposureStage,
  useSceneExposure,
  worldExposureOfScene,
} from './sceneExposure';
import { fireSceneRender, fireSceneRenderEnd } from '../testing/fireSceneRender';

function Exposed({ factor, world = factor }: { factor: number | null; world?: number | null }) {
  useSceneExposure(factor, world);
  return null;
}

const CAMERA = new THREE.PerspectiveCamera();

function sceneOf(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>): THREE.Scene {
  return renderer.scene.instance as THREE.Scene;
}

/** Mounts `factor` and answers the scene its renders are fired on. */
async function mount(factor: number | null) {
  const renderer = await ReactThreeTestRenderer.create(<Exposed factor={factor} />);
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
    EMISSION_EXPOSURE[0] = 5;
    fireSceneRender(scene, CAMERA);
    expect(EMISSION_EXPOSURE[0]).toBe(5);
    EMISSION_EXPOSURE[0] = 1;
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

  it('answers null for a scene with no exposure', async () => {
    const { scene } = await mount(null);
    expect(exposureOfScene(scene)).toBeNull();
  });

  it('keeps the factor of a world that still holds the scene when another unmounts', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <Exposed key="kept" factor={3} />
        <Exposed key="removed" factor={5} />
      </>
    );
    await renderer.update(<Exposed key="kept" factor={3} />);
    expect(exposureOfScene(sceneOf(renderer))).toBe(3);
  });
});

describe('worldExposureOfScene', () => {
  it("answers the factor of the world's own attributes, which a camera's do not change", async () => {
    const renderer = await ReactThreeTestRenderer.create(<Exposed factor={4} world={2} />);
    expect(worldExposureOfScene(sceneOf(renderer))).toBe(2);
  });

  it('answers null for a world with no attributes of its own', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Exposed factor={4} world={null} />);
    expect(worldExposureOfScene(sceneOf(renderer))).toBeNull();
  });
});

describe('drawAtExposure', () => {
  /** The emission factor a render fired inside `drawAtExposure` writes. */
  function emissionDrawnAt(scene: THREE.Scene, exposure: number | null): number {
    return drawAtExposure(scene, exposure, () => {
      fireSceneRender(scene, CAMERA);
      return EMISSION_EXPOSURE[0]!;
    });
  }

  it('draws the emission at the given exposure instead of the one the scene holds', async () => {
    const { scene } = await mount(4);
    expect(emissionDrawnAt(scene, 2)).toBe(2);
  });

  it('draws the emission at 1 for a null exposure', async () => {
    const { scene } = await mount(4);
    expect(emissionDrawnAt(scene, null)).toBe(1);
  });

  it('draws a scene that holds no exposure at the given one', async () => {
    const { scene } = await mount(null);
    expect(emissionDrawnAt(scene, 3)).toBe(3);
  });

  it('puts the emission factor 1 back after the draw', async () => {
    const { scene } = await mount(4);
    emissionDrawnAt(scene, 2);
    expect(EMISSION_EXPOSURE[0]).toBe(1);
  });

  it('draws the next render of the scene at the exposure it holds again', async () => {
    const { scene } = await mount(4);
    emissionDrawnAt(scene, 2);
    fireSceneRender(scene, CAMERA);
    expect(EMISSION_EXPOSURE[0]).toBe(4);
  });

  it('answers what the draw answers', async () => {
    const { scene } = await mount(4);
    expect(drawAtExposure(scene, 2, () => 'drawn')).toBe('drawn');
  });

  it('puts everything back when the draw throws', async () => {
    const { scene } = await mount(4);
    const light = new THREE.PointLight(0xffffff, 8);
    scene.add(light);
    expect(() =>
      drawAtExposure(scene, 2, () => {
        throw new Error('draw failed');
      })
    ).toThrow('draw failed');
    expect(light.intensity).toBe(8);
    expect(EMISSION_EXPOSURE[0]).toBe(1);
    scene.remove(light);
  });

  it('puts everything back when a stage throws', async () => {
    const { scene } = await mount(4);
    const light = new THREE.PointLight(0xffffff, 8);
    scene.add(light);
    const stopStage = registerExposureStage(scene, () => {
      throw new Error('stage failed');
    });
    expect(() => drawAtExposure(scene, 2, () => 'drawn')).toThrow('stage failed');
    stopStage();
    expect(light.intensity).toBe(8);
    expect(EMISSION_EXPOSURE[0]).toBe(1);
    expect(drawnExposureRatio(scene)).toBe(1);
    scene.remove(light);
  });

  it('answers the ratio of the drawn exposure to the held one inside a draw only', async () => {
    const { scene } = await mount(4);
    const inside = drawAtExposure(scene, 2, () => drawnExposureRatio(scene));
    expect([inside, drawnExposureRatio(scene)]).toEqual([0.5, 1]);
  });

  describe('lights', () => {
    it('scales each light by the given exposure over the held one, and puts it back', async () => {
      const { scene } = await mount(4);
      const point = new THREE.PointLight(0xffffff, 8);
      const sun = new THREE.DirectionalLight(0xffffff, 12);
      scene.add(point, sun);
      const inside = drawAtExposure(scene, 2, () => [point.intensity, sun.intensity]);
      expect(inside).toEqual([4, 6]);
      expect([point.intensity, sun.intensity]).toEqual([8, 12]);
      scene.remove(point, sun);
    });

    it('leaves the flat ambient alone, which Godot does not scale', async () => {
      const { scene } = await mount(4);
      const ambient = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambient);
      const inside = drawAtExposure(scene, 2, () => ambient.intensity);
      expect(inside).toBe(0.5);
      scene.remove(ambient);
    });

    it('scales a light of a scene with no exposure as if it held 1', async () => {
      const { scene } = await mount(null);
      const point = new THREE.PointLight(0xffffff, 8);
      scene.add(point);
      const inside = drawAtExposure(scene, 2, () => point.intensity);
      expect(inside).toBe(16);
      scene.remove(point);
    });

    it('keeps a light at the energy it has under a held exposure of 0, which gives no ratio', async () => {
      const { scene } = await mount(0);
      const point = new THREE.PointLight(0xffffff, 0);
      scene.add(point);
      const inside = drawAtExposure(scene, 2, () => point.intensity);
      expect(inside).toBe(0);
      scene.remove(point);
    });

    it('scales a light to 1 over the held exposure for a null exposure', async () => {
      const { scene } = await mount(4);
      const point = new THREE.PointLight(0xffffff, 8);
      scene.add(point);
      const inside = drawAtExposure(scene, null, () => point.intensity);
      expect(inside).toBe(2);
      scene.remove(point);
    });
  });

  describe('stages', () => {
    it('runs each registered stage with the exposure, and runs what it returns after the draw', async () => {
      const { scene } = await mount(4);
      const events: string[] = [];
      registerExposureStage(scene, (exposure) => {
        events.push(`stage ${exposure}`);
        return () => events.push('restore');
      });
      drawAtExposure(scene, 2, () => events.push('draw'));
      expect(events).toEqual(['stage 2', 'draw', 'restore']);
    });

    it('runs no stage once it is unregistered', async () => {
      const { scene } = await mount(4);
      const stage = vi.fn(() => () => {});
      registerExposureStage(scene, stage)();
      drawAtExposure(scene, 2, () => {});
      expect(stage).not.toHaveBeenCalled();
    });

    it('runs no stage and changes no light when the exposure is the held one', async () => {
      const { scene } = await mount(4);
      const stage = vi.fn(() => () => {});
      registerExposureStage(scene, stage);
      drawAtExposure(scene, 4, () => {});
      expect(stage).not.toHaveBeenCalled();
    });

    it('runs no stage when neither the scene nor the draw holds an exposure', async () => {
      const { scene } = await mount(null);
      const stage = vi.fn(() => () => {});
      registerExposureStage(scene, stage);
      drawAtExposure(scene, null, () => {});
      expect(stage).not.toHaveBeenCalled();
    });
  });
});
