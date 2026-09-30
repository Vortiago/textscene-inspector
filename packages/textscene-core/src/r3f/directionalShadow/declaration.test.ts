import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { directionalShadowUserData, readDirectionalShadowDeclaration } from './declaration';

const DECLARATION = { maxDistance: 80, pancakeSize: 20, depthBias: -0.002, normalBias: 2 };

describe('directionalShadowUserData', () => {
  it('declares a shadow that readDirectionalShadowDeclaration reads back', () => {
    const light = new THREE.DirectionalLight();
    light.userData = directionalShadowUserData(DECLARATION);
    expect(readDirectionalShadowDeclaration(light)).toEqual(DECLARATION);
  });

  it('keeps a zero max distance, which the fit reads as the camera far plane (edge case)', () => {
    const light = new THREE.DirectionalLight();
    light.userData = directionalShadowUserData({ ...DECLARATION, maxDistance: 0 });
    expect(readDirectionalShadowDeclaration(light)?.maxDistance).toBe(0);
  });
});

describe('readDirectionalShadowDeclaration', () => {
  it('answers null for a light that declared nothing', () => {
    expect(readDirectionalShadowDeclaration(new THREE.DirectionalLight())).toBeNull();
  });

  it('answers null for a malformed declaration (error case)', () => {
    const light = new THREE.DirectionalLight();
    light.userData = { directionalShadow: { maxDistance: '80', pancakeSize: 20, depthBias: 0, normalBias: 2 } };
    expect(readDirectionalShadowDeclaration(light)).toBeNull();
  });

  it('answers null for a declaration that is not an object (edge case)', () => {
    const light = new THREE.DirectionalLight();
    light.userData = { directionalShadow: null };
    expect(readDirectionalShadowDeclaration(light)).toBeNull();
  });
});
