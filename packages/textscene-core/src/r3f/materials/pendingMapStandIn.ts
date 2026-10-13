/**
 * The texture a material slot binds while its map is on its way. three bakes each
 * slot's presence into the program, so a map that arrives into an empty slot
 * relinks the material. That link blocked the main thread for 539–838 ms in headless
 * Chromium, which offers no parallel shader compile. A stand-in keeps the slot
 * filled, so the map swaps in as a new texture on the program already linked.
 */

import * as THREE from 'three';
import { slotColorSpace } from '../../resources/materials/standardmaterial3d/textureBinding';
import type { TextureSlot } from '../../resources/materials/standardmaterial3d/types';

type Rgb = readonly [number, number, number];

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

/**
 * The texel that leaves three's formula for each slot as it is without the map.
 * Albedo, roughness (G), metalness (B) and occlusion (the `ao_texture_channel` channel, alpha
 * included) multiply by the texel.
 * Displacement adds it. Emission multiplies by it, but a map turns a black emission
 * colour white (`emission.ts`), so only black keeps the surface dark. A normal and a
 * flowmap decode `2 * rg - 1`, so 128 points along the normal and 255 along the tangent.
 */
const NEUTRAL_TEXEL: Readonly<Record<TextureSlot, Rgb>> = {
  albedo_texture: WHITE,
  roughness_texture: WHITE,
  metallic_texture: WHITE,
  ao_texture: WHITE,
  emission_texture: BLACK,
  heightmap_texture: BLACK,
  normal_texture: [128, 128, 255],
  anisotropy_flowmap: [255, 128, 255],
};

/** Written once per slot, on its first request. Never disposed: every slot of that kind shares it. */
const standIns = new Map<TextureSlot, THREE.DataTexture>();

export function pendingMapStandIn(slot: TextureSlot): THREE.DataTexture {
  const existing = standIns.get(slot);
  if (existing) return existing;
  const standIn = new THREE.DataTexture(new Uint8Array([...NEUTRAL_TEXEL[slot], 255]), 1, 1);
  standIn.colorSpace = slotColorSpace(slot);
  standIn.needsUpdate = true;
  standIns.set(slot, standIn);
  return standIn;
}
