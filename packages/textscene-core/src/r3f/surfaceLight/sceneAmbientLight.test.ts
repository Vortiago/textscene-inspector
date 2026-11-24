import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LIGHT_INTENSITY_SCALE } from '../lightConstants';
import { drawWith } from '../environment/sceneEnvironment';
import { sceneAmbientLight } from './sceneAmbientLight';

const CLEAR = new THREE.Color(0.3, 0.3, 0.3);

/** A scene with a flat ambient light of `energy` in red. */
function sceneWithAmbient(energy: number): { scene: THREE.Scene; light: THREE.AmbientLight } {
  const scene = new THREE.Scene();
  const light = new THREE.AmbientLight(new THREE.Color(1, 0, 0), energy * LIGHT_INTENSITY_SCALE);
  scene.add(light);
  return { scene, light };
}

/** The ambient light of a draw of `scene` with an Environment on it. */
function underEnvironment(scene: THREE.Scene): number[] {
  return drawWith(scene, {}, null, () => sceneAmbientLight(scene, CLEAR, new THREE.Color()).toArray());
}

describe('sceneAmbientLight', () => {
  it('is the clear colour with no Environment', () => {
    const { scene } = sceneWithAmbient(2);
    expect(sceneAmbientLight(scene, CLEAR, new THREE.Color()).toArray()).toEqual([0.3, 0.3, 0.3]);
  });

  it("is the flat ambient light's colour and energy under an Environment", () => {
    expect(underEnvironment(sceneWithAmbient(2).scene)).toEqual([2, 0, 0]);
  });

  it('is black under an Environment with no flat ambient light shown', () => {
    const { scene, light } = sceneWithAmbient(2);
    light.visible = false;
    expect(underEnvironment(scene)).toEqual([0, 0, 0]);
  });
});
