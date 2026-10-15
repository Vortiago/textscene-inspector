import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LIGHT_INTENSITY_SCALE } from '../lightConstants';
import { skyLightEnergy, skyLightUserData } from './skyLight';

const lightWith = (userData: Record<string, unknown>) => {
  const light = new THREE.DirectionalLight();
  light.userData = userData;
  return light;
};

describe('skyLightEnergy', () => {
  it('reads the energy a light declares for the sky', () => {
    const light = lightWith(skyLightUserData({ drawsInSky: true, energy: 2 }));
    expect(skyLightEnergy(light)).toBe(2);
  });

  it('reads the declaration beside another entry in the same userData (edge case)', () => {
    const light = lightWith({ other: 1, ...skyLightUserData({ drawsInSky: true, energy: 1 }) });
    expect(skyLightEnergy(light)).toBe(1);
  });

  it('answers null for a light the sky skips', () => {
    const light = lightWith(skyLightUserData({ drawsInSky: false, energy: 2 }));
    expect(skyLightEnergy(light)).toBeNull();
  });

  it('takes an undeclared light back through the intensity scale (edge case)', () => {
    const light = lightWith({});
    light.intensity = 3 * LIGHT_INTENSITY_SCALE;
    expect(skyLightEnergy(light)).toBeCloseTo(3, 10);
  });

  it('takes a light with a malformed declaration back through the intensity scale (error case)', () => {
    const light = lightWith({ skyLight: { drawsInSky: 'yes', energy: 1 } });
    light.intensity = 3 * LIGHT_INTENSITY_SCALE;
    expect(skyLightEnergy(light)).toBeCloseTo(3, 10);
  });
});

describe('skyLightUserData', () => {
  it('declares under one key, so a light that merges it carries one sky declaration', () => {
    expect(Object.keys(skyLightUserData({ drawsInSky: true, energy: 1 }))).toHaveLength(1);
  });

  it('keeps a zero energy, which a Sky Only light never has (edge case)', () => {
    const light = lightWith(skyLightUserData({ drawsInSky: true, energy: 0 }));
    expect(skyLightEnergy(light)).toBe(0);
  });

  it('declares a non-finite energy as written, for the sky to read (error case)', () => {
    const light = lightWith(skyLightUserData({ drawsInSky: true, energy: Number.NaN }));
    expect(skyLightEnergy(light)).toBeNaN();
  });
});
