import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TEXTURE_SLOTS, type TextureSlot } from '../../resources/materials/standardmaterial3d/types';
import { isMaterialOwnedTexture } from '../../resources/textures/applyTextureState';
import { pendingMapStandIn } from './pendingMapStandIn';

function texel(slot: TextureSlot): number[] {
  return [...(pendingMapStandIn(slot).image.data as Uint8Array)];
}

describe('pendingMapStandIn', () => {
  it('is one opaque texel, the same texture on every call', () => {
    for (const slot of TEXTURE_SLOTS) {
      const standIn = pendingMapStandIn(slot);
      expect(standIn).toBe(pendingMapStandIn(slot));
      expect([standIn.image.width, standIn.image.height]).toEqual([1, 1]);
      expect(texel(slot)[3]).toBe(255);
    }
  });

  it('multiplies albedo, roughness, metallic and occlusion by one', () => {
    for (const slot of ['albedo_texture', 'roughness_texture', 'metallic_texture', 'ao_texture'] as const) {
      expect(texel(slot)).toEqual([255, 255, 255, 255]);
    }
  });

  it('adds no emission and no displacement', () => {
    expect(texel('emission_texture')).toEqual([0, 0, 0, 255]);
    expect(texel('heightmap_texture')).toEqual([0, 0, 0, 255]);
  });

  it('points the normal along the surface normal and the flowmap along the tangent, at full strength', () => {
    expect(texel('normal_texture')).toEqual([128, 128, 255, 255]);
    expect(texel('anisotropy_flowmap')).toEqual([255, 128, 255, 255]);
  });

  it('decodes sRGB only where the slot does', () => {
    expect(pendingMapStandIn('albedo_texture').colorSpace).toBe(THREE.SRGBColorSpace);
    expect(pendingMapStandIn('emission_texture').colorSpace).toBe(THREE.SRGBColorSpace);
    expect(pendingMapStandIn('normal_texture').colorSpace).toBe(THREE.NoColorSpace);
  });

  it('is never released with a material, since every slot shares it', () => {
    for (const slot of TEXTURE_SLOTS) expect(isMaterialOwnedTexture(pendingMapStandIn(slot))).toBe(false);
  });
});
