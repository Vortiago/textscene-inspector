/** What a Texture3D resource draws, as the `TEXTURE_3D` kind decodes it. No THREE. */

import type { SavedImage } from '../image/kind';
import type { NoiseSources } from '../noiseSources';
import type { NoiseTexture3DData } from '../noisetexture3d/types';

export type Texture3D =
  /** An image its **Import sidecar** imports as a 3D texture. */
  { readonly form: 'file'; readonly path: string } | NoiseTexture3DSource | ImageTexture3DSource;

export interface NoiseTexture3DSource {
  readonly form: 'noise';
  readonly texture: NoiseTexture3DData;
  readonly sources: NoiseSources;
}

export interface ImageTexture3DSource {
  readonly form: 'image';
  /** The slices, in order. */
  readonly images: readonly SavedImage[];
}
