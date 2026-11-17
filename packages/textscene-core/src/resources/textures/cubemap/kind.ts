import { isTexturePath } from '../../formats/image/textureProcessing';
import { IMPORTED_FILE, type Follow, type HeldResource, type ResourceKind } from '../../reading';
import { savedImages } from '../texture3d/kind';
import type { CubemapSource } from './types';

type SourceDecode = (held: HeldResource, follow: Follow) => CubemapSource | null;

/** A Cubemap from a `.tres` that saves its faces, or an image imported as a cubemap. No THREE. */
export const CUBEMAP: ResourceKind<CubemapSource> = {
  name: 'Cubemap',
  accepts: (type) => Object.hasOwn(SOURCES, type),
  decode: (held, follow) => SOURCES[held.type]!(held, follow),
};

const SOURCES: Readonly<Record<string, SourceDecode>> = {
  Cubemap: ({ properties }, follow) => {
    const images = savedImages(properties._images, follow);
    return images && { form: 'image', images };
  },
  [IMPORTED_FILE]: ({ address }) =>
    address && isTexturePath(address) ? { form: 'file', path: address } : null,
};
