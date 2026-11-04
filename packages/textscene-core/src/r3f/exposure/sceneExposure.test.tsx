/**
 * Each render of a scene applies the exposure it draws at, and puts back what it found when the
 * render ends, so a scene never draws with another's exposure.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { EMISSION_EXPOSURE } from './emissionExposure';
import { drawAtExposure, followSceneExposure, useSceneExposure, worldExposureOfScene } from './sceneExposure';
import { fireSceneRender, fireSceneRenderEnd } from '../testing/fireSceneRender';
import { observeSceneCamera } from '../sceneRenderCamera';

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

/** The emission factor inside a render of `scene`, which ends before this answers. */
function emissionInRender(scene: THREE.Scene): number {
  fireSceneRender(scene, CAMERA);
  const inside = EMISSION_EXPOSURE[0]!;
  fireSceneRenderEnd(scene, CAMERA);
  return inside;
}

describe('useSceneExposure', () => {
  it('writes the factor into the emission uniform for a render of the scene', async () => {
    const { scene } = await mount(2);
    expect(emissionInRender(scene)).toBe(2);
  });

  it('puts the factor 1 back when the render ends', async () => {
    const { scene } = await mount(2);
    emissionInRender(scene);
    expect(EMISSION_EXPOSURE[0]).toBe(1);
  });

  it('writes a factor of 0, which darkens the emission to nothing (edge case)', async () => {
    const { scene } = await mount(0);
    expect(emissionInRender(scene)).toBe(0);
  });

  it('writes a new factor from the next render on', async () => {
    const { renderer, scene } = await mount(2);
    await renderer.update(<Exposed factor={6} />);
    expect(emissionInRender(scene)).toBe(6);
  });

  it("leaves three's own render hook on a scene that holds no exposure", async () => {
    const { scene } = await mount(null);
    expect(scene.onBeforeRender).toBe(THREE.Object3D.prototype.onBeforeRender);
  });

  it('stops writing when the world unmounts', async () => {
    const { renderer, scene } = await mount(2);
    await renderer.update(null);
    expect(emissionInRender(scene)).toBe(1);
  });

  it('keeps the factor of a world that still holds the scene when another unmounts', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <Exposed key="kept" factor={3} />
        <Exposed key="removed" factor={5} />
      </>
    );
    await renderer.update(<Exposed key="kept" factor={3} />);
    expect(emissionInRender(sceneOf(renderer))).toBe(3);
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

/** What `light` holds inside a render of `scene`, and after the render ends. */
function intensityInRender(scene: THREE.Scene, light: THREE.Light): [number, number] {
  fireSceneRender(scene, CAMERA);
  const inside = light.intensity;
  fireSceneRenderEnd(scene, CAMERA);
  return [inside, light.intensity];
}

describe('lights in a render', () => {
  it('draws each light at its energy times the exposure, and holds its energy outside the render', async () => {
    const { scene } = await mount(2);
    const point = new THREE.PointLight(0xffffff, 8);
    scene.add(point);
    expect(intensityInRender(scene, point)).toEqual([16, 8]);
    scene.remove(point);
  });

  it('draws a light added after the world mounts', async () => {
    const { scene } = await mount(2);
    fireSceneRender(scene, CAMERA);
    fireSceneRenderEnd(scene, CAMERA);
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    scene.add(sun);
    expect(intensityInRender(scene, sun)).toEqual([6, 3]);
    scene.remove(sun);
  });

  it('keeps the sign of a negative light (edge case)', async () => {
    const { scene } = await mount(2);
    const point = new THREE.PointLight(0xffffff, -8);
    scene.add(point);
    expect(intensityInRender(scene, point)).toEqual([-16, -8]);
    scene.remove(point);
  });

  it('leaves the flat ambient alone, which Godot does not scale', async () => {
    const { scene } = await mount(2);
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    expect(intensityInRender(scene, ambient)).toEqual([0.5, 0.5]);
    scene.remove(ambient);
  });

  it('draws a light at its energy in a world with no exposure', async () => {
    const { scene } = await mount(null);
    const point = new THREE.PointLight(0xffffff, 8);
    scene.add(point);
    expect(intensityInRender(scene, point)).toEqual([8, 8]);
    scene.remove(point);
  });

  it('draws no light under an exposure of 0 (edge case)', async () => {
    const { scene } = await mount(0);
    const point = new THREE.PointLight(0xffffff, 8);
    scene.add(point);
    expect(intensityInRender(scene, point)).toEqual([0, 8]);
    scene.remove(point);
  });

  it('scales the energy once when a render never ended', async () => {
    const { scene } = await mount(2);
    const point = new THREE.PointLight(0xffffff, 8);
    scene.add(point);
    fireSceneRender(scene, CAMERA);
    expect(intensityInRender(scene, point)).toEqual([16, 8]);
    scene.remove(point);
  });

  it('scales the energy an observer wrote for the render, such as a distance fade', async () => {
    const { scene } = await mount(2);
    const point = new THREE.PointLight(0xffffff, 8);
    scene.add(point);
    const stop = observeSceneCamera(scene, () => {
      point.intensity = 4;
    });
    expect(intensityInRender(scene, point)[0]).toBe(8);
    stop();
    scene.remove(point);
  });
});

describe('drawAtExposure', () => {
  /** The emission factor a render fired inside `drawAtExposure` writes. */
  function emissionDrawnAt(scene: THREE.Scene, exposure: number | null): number {
    return drawAtExposure(scene, exposure, () => emissionInRender(scene));
  }

  /** What `light` holds in a render fired inside `drawAtExposure`. */
  function intensityDrawnAt(scene: THREE.Scene, light: THREE.Light, exposure: number | null): number {
    return drawAtExposure(scene, exposure, () => intensityInRender(scene, light)[0]);
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

  it('draws the next render of the scene at the exposure it holds again', async () => {
    const { scene } = await mount(4);
    emissionDrawnAt(scene, 2);
    expect(emissionInRender(scene)).toBe(4);
  });

  it('answers what the draw answers', async () => {
    const { scene } = await mount(4);
    expect(drawAtExposure(scene, 2, () => 'drawn')).toBe('drawn');
  });

  it('draws each light at its energy times the given exposure, whatever the scene holds', async () => {
    const { scene } = await mount(4);
    const point = new THREE.PointLight(0xffffff, 8);
    scene.add(point);
    expect([intensityDrawnAt(scene, point, 2), point.intensity]).toEqual([16, 8]);
    scene.remove(point);
  });

  it('lights each light at its energy times 2 at 2 over a held exposure of 0', async () => {
    const { scene } = await mount(0);
    const point = new THREE.PointLight(0xffffff, 8);
    scene.add(point);
    expect(intensityDrawnAt(scene, point, 2)).toBe(16);
    scene.remove(point);
  });

  it('draws each light at its energy for a null exposure', async () => {
    const { scene } = await mount(4);
    const point = new THREE.PointLight(0xffffff, 8);
    scene.add(point);
    expect(intensityDrawnAt(scene, point, null)).toBe(8);
    scene.remove(point);
  });

  it('draws the held exposure again once the draw throws', async () => {
    const { scene } = await mount(4);
    expect(() =>
      drawAtExposure(scene, 2, () => {
        throw new Error('draw failed');
      })
    ).toThrow('draw failed');
    expect(emissionInRender(scene)).toBe(4);
  });
});

describe('followSceneExposure', () => {
  /** The exposures `follow` sees in a render of `scene`, drawn by `draw`. */
  function followed(scene: THREE.Scene, draw: (render: () => void) => void): (number | null)[] {
    const seen: (number | null)[] = [];
    const stop = followSceneExposure(scene, (exposure) => seen.push(exposure));
    draw(() => fireSceneRender(scene, CAMERA));
    stop();
    return seen;
  }

  it('runs a follower in each render with the exposure the scene holds', async () => {
    const { scene } = await mount(3);
    expect(followed(scene, (render) => render())).toEqual([3]);
  });

  it('runs a follower with null in a world that holds no exposure', async () => {
    const { scene } = await mount(null);
    expect(followed(scene, (render) => render())).toEqual([null]);
  });

  it('runs a follower with the exposure a draw at another exposure draws at', async () => {
    const { scene } = await mount(3);
    expect(followed(scene, (render) => drawAtExposure(scene, 0.5, render))).toEqual([0.5]);
  });

  it('runs a follower of a scene with no world for a draw at another exposure', () => {
    const scene = new THREE.Scene();
    expect(followed(scene, (render) => drawAtExposure(scene, 2, render))).toEqual([2]);
  });

  it('runs a follower no more once it stops', async () => {
    const { scene } = await mount(3);
    const follower = vi.fn();
    followSceneExposure(scene, follower)();
    fireSceneRender(scene, CAMERA);
    expect(follower).not.toHaveBeenCalled();
  });
});
