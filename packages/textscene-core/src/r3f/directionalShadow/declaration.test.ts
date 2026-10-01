import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { directionalShadowUserData, readDirectionalShadowDeclaration } from './declaration';

const DECLARATION = {
  maxDistance: 80,
  pancakeSize: 20,
  fadeStart: 0.8,
  depthBias: -0.002,
  normalBias: 2,
  filterRadius: 2,
  splitCount: 4,
  splitOffsets: [0.1, 0.2, 0.5],
  blendSplits: false,
  sharesAtlas: true,
};

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
    light.userData = { directionalShadow: { ...DECLARATION, maxDistance: '80' } };
    expect(readDirectionalShadowDeclaration(light)).toBeNull();
  });

  it('answers null for a declaration without its splits (error case)', () => {
    const { splitCount: _splitCount, ...withoutSplits } = DECLARATION;
    const light = new THREE.DirectionalLight();
    light.userData = { directionalShadow: withoutSplits };
    expect(readDirectionalShadowDeclaration(light)).toBeNull();
  });

  it('answers null for a declaration without a fade start (error case)', () => {
    const light = new THREE.DirectionalLight();
    const { fadeStart: _fadeStart, ...withoutFade } = DECLARATION;
    light.userData = { directionalShadow: withoutFade };
    expect(readDirectionalShadowDeclaration(light)).toBeNull();
  });

  it('answers null for a declaration without its filter radius (error case)', () => {
    const light = new THREE.DirectionalLight();
    const { filterRadius: _filterRadius, ...withoutRadius } = DECLARATION;
    light.userData = { directionalShadow: withoutRadius };
    expect(readDirectionalShadowDeclaration(light)).toBeNull();
  });

  it('answers null for a declaration without its atlas share (error case)', () => {
    const light = new THREE.DirectionalLight();
    const { sharesAtlas: _sharesAtlas, ...withoutShare } = DECLARATION;
    light.userData = { directionalShadow: withoutShare };
    expect(readDirectionalShadowDeclaration(light)).toBeNull();
  });

  it('answers null for a declaration that is not an object (edge case)', () => {
    const light = new THREE.DirectionalLight();
    light.userData = { directionalShadow: null };
    expect(readDirectionalShadowDeclaration(light)).toBeNull();
  });
});
