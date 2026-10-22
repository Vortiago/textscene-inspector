import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { passBlendMaterialProps, type PassBlend } from './surfaceBlend';
import { DRAWN_OPAQUE_PREPASS, opaquePrepassOf } from './opaquePrepass';
import { alphaAntialiasingOf } from './godotAlphaAntialiasing';
import { AlphaAntiAliasing } from '../../godot/rendering/materials/alphaAntialiasing';

const HASHED: PassBlend = {
  transparent: false,
  depthWrite: true,
  alphaTest: 0,
  alphaHash: true,
  blending: THREE.NormalBlending,
  alphaHashScale: 1.5,
  opaquePrepass: DRAWN_OPAQUE_PREPASS,
  antialiasing: {
    mode: AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE,
    scissorThreshold: 0,
    edge: 0.3,
  },
};

describe('passBlendMaterialProps', () => {
  it('builds a material with the pass’s blend state', () => {
    const material = new THREE.MeshBasicMaterial(passBlendMaterialProps(HASHED));
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
    expect(material.alphaHash).toBe(true);
    expect(material.alphaToCoverage).toBe(true);
  });

  it('records the hash scale, the antialiasing and the opaque prepass the patches read', () => {
    const material = new THREE.MeshBasicMaterial(passBlendMaterialProps(HASHED));
    expect(material.userData.godotAlphaHashScale).toBe(1.5);
    expect(alphaAntialiasingOf(material)).toBe(HASHED.antialiasing);
    expect(opaquePrepassOf(material)).toBe(DRAWN_OPAQUE_PREPASS);
  });
});
