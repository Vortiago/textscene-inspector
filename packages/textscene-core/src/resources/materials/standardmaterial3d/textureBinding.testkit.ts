/** A slot's texture as a material binds it, for tests that read the result. */

import type * as THREE from 'three';
import { textureView } from '../../textures/textureView';
import { slotViewSampler, type MaterialTextureStates } from './textureBinding';
import type { TextureSlot } from './types';

/** The texture `slot` samples: `texture` when it carries everything the binding needs, else one clone. */
export function bindSlotTexture(
  texture: THREE.Texture,
  slot: TextureSlot,
  states: MaterialTextureStates
): THREE.Texture {
  return textureView(texture, slotViewSampler(texture, slot, states));
}
