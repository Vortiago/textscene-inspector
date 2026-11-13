/** The source of the pixels a Texture2D names, decoded from tables a test writes as text. */

import { loadedValue } from '../../reading/reading.testkit';
import { TEXTURE_2D } from './kind';
import type { Texture2DSource } from './types';

/** The source `ref` names in a scene written as `sceneText`. Throws for a CanvasTexture or AtlasTexture layer. */
export function texture2DSourceAt(ref: string, sceneText: string): Texture2DSource {
  const texture = loadedValue(TEXTURE_2D, ref, sceneText);
  if (texture.form === 'canvas' || texture.form === 'atlas')
    throw new Error(`expected a source, got ${texture.form}`);
  return texture;
}
