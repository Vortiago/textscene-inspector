import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { scaleLightIntensities } from './scaleLightIntensities';

describe('scaleLightIntensities', () => {
  it('multiplies the intensity of each light by the factor', () => {
    const lights = [new THREE.PointLight(0xffffff, 2), new THREE.SpotLight(0xffffff, 3)];
    scaleLightIntensities(lights, 0.5);
    expect(lights.map((light) => light.intensity)).toEqual([1, 1.5]);
  });

  it('puts back the intensity each light held when the returned function runs', () => {
    const lights = [new THREE.PointLight(0xffffff, 2), new THREE.SpotLight(0xffffff, 3)];
    const restore = scaleLightIntensities(lights, 4);
    restore();
    expect(lights.map((light) => light.intensity)).toEqual([2, 3]);
  });
});
