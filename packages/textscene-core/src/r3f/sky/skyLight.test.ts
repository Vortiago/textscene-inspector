import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { readSkyLightDeclaration, skyLightUserData } from './skyLight';

const lightWith = (userData: Record<string, unknown>) => {
  const light = new THREE.DirectionalLight();
  light.userData = userData;
  return light;
};

describe('readSkyLightDeclaration', () => {
  it('reads back the declaration a light carries', () => {
    const light = lightWith(skyLightUserData({ drawsInSky: false, energy: 2 }));
    expect(readSkyLightDeclaration(light)).toEqual({ drawsInSky: false, energy: 2 });
  });

  it('reads the declaration beside another entry in the same userData (edge case)', () => {
    const light = lightWith({ other: 1, ...skyLightUserData({ drawsInSky: true, energy: 1 }) });
    expect(readSkyLightDeclaration(light)).toEqual({ drawsInSky: true, energy: 1 });
  });

  it('is null for a light that declares nothing', () => {
    expect(readSkyLightDeclaration(new THREE.DirectionalLight())).toBeNull();
  });

  it('is null for a malformed declaration (error case)', () => {
    expect(readSkyLightDeclaration(lightWith({ skyLight: { drawsInSky: 'yes', energy: 1 } }))).toBeNull();
  });
});
