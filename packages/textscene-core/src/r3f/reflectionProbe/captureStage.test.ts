import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { stageCapture } from './captureStage';
import { setVisualLayers } from '../visualLayers';

const CLEAR = new THREE.Color(0.3, 0.3, 0.3);

function meshOnLayers(layers: number): THREE.Mesh {
  const mesh = new THREE.Mesh();
  setVisualLayers(mesh, layers);
  return mesh;
}

function litScene() {
  const scene = new THREE.Scene();
  const background = new THREE.Color(0, 0, 1);
  scene.background = background;
  scene.environmentIntensity = 2;
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  return { scene, background, ambient };
}

describe('stageCapture', () => {
  it('hides an instance whose layers miss the cull mask, until the restore', () => {
    const scene = new THREE.Scene();
    const hidden = meshOnLayers(2);
    const shown = meshOnLayers(3);
    scene.add(hidden, shown);

    const restore = stageCapture(scene, { cullMask: 1, interior: false }, CLEAR);
    const during = [hidden.visible, shown.visible];
    restore();

    expect(during).toEqual([false, true]);
    expect(hidden.visible).toBe(true);
  });

  it('hides a light whose layers miss the cull mask, as Godot culls every instance by it', () => {
    const scene = new THREE.Scene();
    const light = new THREE.SpotLight();
    setVisualLayers(light, 4);
    scene.add(light);

    const restore = stageCapture(scene, { cullMask: 1, interior: false }, CLEAR);
    const during = light.visible;
    restore();

    expect([during, light.visible]).toEqual([false, true]);
  });

  it("keeps the environment's ambient whatever the cull mask, as it is no instance (edge case)", () => {
    const { scene, ambient } = litScene();

    stageCapture(scene, { cullMask: 0, interior: false }, CLEAR);

    expect([ambient.visible, ambient.intensity]).toEqual([true, 0.6]);
  });

  it('drops the environment of an interior capture: its sky, its ambient and its background', () => {
    const { scene, background, ambient } = litScene();

    const restore = stageCapture(scene, { cullMask: 1, interior: true }, CLEAR);
    const during = [scene.environmentIntensity, ambient.intensity, scene.background];
    restore();

    expect(during).toEqual([0, 0, CLEAR]);
    expect([scene.environmentIntensity, ambient.intensity, scene.background]).toEqual([2, 0.6, background]);
  });

  it('leaves the environment of an exterior capture (edge case)', () => {
    const { scene, background } = litScene();

    stageCapture(scene, { cullMask: 1, interior: false }, CLEAR);

    expect([scene.environmentIntensity, scene.background]).toEqual([2, background]);
  });
});
