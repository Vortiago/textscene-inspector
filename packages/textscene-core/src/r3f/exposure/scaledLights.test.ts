import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ScaledLights } from './scaledLights';

const twoLights = () => [new THREE.PointLight(0xffffff, 2), new THREE.SpotLight(0xffffff, 3)];

describe('ScaledLights', () => {
  it('multiplies the intensity of each light by the factor', () => {
    const lights = twoLights();
    new ScaledLights().scale(lights, 0.5);
    expect(lights.map((light) => light.intensity)).toEqual([1, 1.5]);
  });

  it('puts back the intensity each light held', () => {
    const lights = twoLights();
    const scaled = new ScaledLights();
    scaled.scale(lights, 4);
    scaled.restore();
    expect(lights.map((light) => light.intensity)).toEqual([2, 3]);
  });

  it('scales from the held intensity when a scale was never put back', () => {
    const lights = twoLights();
    const scaled = new ScaledLights();
    scaled.scale(lights, 4);
    scaled.scale(lights, 2);
    expect(lights.map((light) => light.intensity)).toEqual([4, 6]);
  });

  it('puts back nothing a second time', () => {
    const lights = twoLights();
    const scaled = new ScaledLights();
    scaled.scale(lights, 4);
    scaled.restore();
    lights[0]!.intensity = 7;
    scaled.restore();
    expect(lights[0]!.intensity).toBe(7);
  });
});
