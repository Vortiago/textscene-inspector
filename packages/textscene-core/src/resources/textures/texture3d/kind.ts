/**
 * The `TEXTURE_3D` kind: what a Texture3D resource draws, from any origin: a NoiseTexture3D, an
 * ImageTexture3D, or an image imported as a 3D texture. No THREE: the hook builds the GPU texture.
 */

import { isTexturePath } from '../../formats/image/textureProcessing';
import { IMPORTED_FILE, type Follow, type HeldResource, type ResourceKind } from '../../reading';
import { IMAGE, type SavedImage } from '../image/kind';
import { imageReferences } from '../imagetexture3d/decode';
import { readNoiseSources } from '../noiseSources';
import { decodeNoiseTexture3D } from '../noisetexture3d/decode';
import type { Texture3D } from './types';

type SourceDecode = (held: HeldResource, follow: Follow) => Texture3D | null;

export const TEXTURE_3D: ResourceKind<Texture3D> = {
  name: 'Texture3D',
  accepts: (type) => Object.hasOwn(SOURCES, type),
  decode: (held, follow) => SOURCES[held.type]!(held, follow),
};

/** Each Image `_images` names. Null when any element names no Image. */
function savedImages(value: string | undefined, follow: Follow): SavedImage[] | null {
  const images: SavedImage[] = [];
  for (const ref of imageReferences(value) ?? []) {
    const image = follow.read(IMAGE, ref).value;
    if (!image) return null;
    images.push(image);
  }
  return images;
}

const SOURCES: Readonly<Record<string, SourceDecode>> = {
  NoiseTexture3D: ({ properties }, follow) => {
    const texture = decodeNoiseTexture3D(properties);
    const sources = readNoiseSources(texture, follow);
    return sources && { form: 'noise', texture, sources };
  },
  ImageTexture3D: ({ properties }, follow) => {
    const images = savedImages(properties._images, follow);
    return images && { form: 'image', images };
  },
  [IMPORTED_FILE]: ({ address }) =>
    address && isTexturePath(address) ? { form: 'file', path: address } : null,
};
