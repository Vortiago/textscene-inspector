import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { positionalShadowUserData, readPositionalShadowDeclaration } from './declaration';

const DECLARATION = { normalBias: 1, softShadowScale: 2 };

describe('positionalShadowUserData', () => {
  it('declares a shadow that readPositionalShadowDeclaration reads back', () => {
    const light = new THREE.SpotLight();
    light.userData = positionalShadowUserData(DECLARATION);
    expect(readPositionalShadowDeclaration(light)).toEqual(DECLARATION);
  });

  it('keeps a zero normal bias and a zero blur (edge case)', () => {
    const light = new THREE.PointLight();
    light.userData = positionalShadowUserData({ normalBias: 0, softShadowScale: 0 });
    expect(readPositionalShadowDeclaration(light)).toEqual({ normalBias: 0, softShadowScale: 0 });
  });
});

describe('readPositionalShadowDeclaration', () => {
  it('answers null for a light that declared nothing', () => {
    expect(readPositionalShadowDeclaration(new THREE.PointLight())).toBeNull();
  });

  it('answers null for a malformed declaration (error case)', () => {
    const light = new THREE.PointLight();
    light.userData = { positionalShadow: { normalBias: '1', softShadowScale: 2 } };
    expect(readPositionalShadowDeclaration(light)).toBeNull();
  });
});
