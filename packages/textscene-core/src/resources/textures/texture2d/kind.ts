/**
 * The `TEXTURE_2D` kind: what a Texture2D resource draws, from any origin. A CanvasTexture follows
 * its `diffuse_texture` and an AtlasTexture its `atlas`, each with this same kind, so a resource
 * file is legal at every position of the chain. No THREE: the hook builds the GPU texture.
 */

import { resolveViewportTexturePath } from '../../../r3f/viewportTexturePath';
import { isTexturePath } from '../../formats/image/textureProcessing';
import {
  IMPORTED_FILE,
  optionalReference,
  type Follow,
  type HeldResource,
  type ResourceKind,
} from '../../reading';
import { decodeAtlasTexture } from '../atlastexture/decode';
import { ATLAS_TEXTURE_TYPE } from '../atlastexture/types';
import { decodeCanvasTexture } from '../canvastexture/decode';
import { CANVAS_TEXTURE_TYPE } from '../canvastexture/types';
import { decodeGradientTexture2D, GRADIENT } from '../gradienttexture2d/decode';
import { IMAGE } from '../image/kind';
import { readNoiseSources } from '../noiseSources';
import { decodeNoiseTexture2D } from '../noisetexture2d/decode';
import { VIEWPORT_TEXTURE_TYPE } from '../viewporttexture/types';
import type { Texture2D } from './types';

type LayerDecode = (held: HeldResource, follow: Follow) => Texture2D | null;

export const TEXTURE_2D: ResourceKind<Texture2D> = {
  name: 'Texture2D',
  accepts: (type) => Object.hasOwn(LAYERS, type),
  decode: (held, follow) => LAYERS[held.type]!(held, follow),
};

const LAYERS: Readonly<Record<string, LayerDecode>> = {
  [CANVAS_TEXTURE_TYPE]: ({ properties }, follow) => ({
    form: 'canvas',
    canvasTexture: {
      texture: decodeCanvasTexture(properties),
      // A map is null with no property, as `CanvasTexture` shades no normal map it was not given.
      normalTexture: optionalReference(follow, properties.normal_texture),
      specularTexture: optionalReference(follow, properties.specular_texture),
    },
    diffuse: follow.read(TEXTURE_2D, properties.diffuse_texture),
  }),
  [ATLAS_TEXTURE_TYPE]: ({ properties }, follow) => ({
    form: 'atlas',
    atlas: decodeAtlasTexture(properties),
    sheet: follow.read(TEXTURE_2D, properties.atlas),
  }),
  // A Gradient that names a missing resource draws nothing. Only no `gradient` at all gives the placeholder.
  GradientTexture2D: ({ properties }, follow) => {
    const gradient = follow.read(GRADIENT, properties.gradient);
    if (gradient.status === 'unavailable') return null;
    return { form: 'gradient', texture: decodeGradientTexture2D(properties), gradient: gradient.value };
  },
  NoiseTexture2D: ({ properties }, follow) => {
    const texture = decodeNoiseTexture2D(properties);
    const sources = readNoiseSources(texture, follow);
    return sources && { form: 'noise', texture, sources };
  },
  ImageTexture: ({ properties }, follow) => {
    const image = follow.read(IMAGE, properties.image).value;
    return image && { form: 'image', image };
  },
  [VIEWPORT_TEXTURE_TYPE]: (held) => ({
    form: 'viewport',
    viewportPath: resolveViewportTexturePath(held.properties.viewport_path),
    isSetUp: held.isHeldLocally && held.isLocalToScene,
  }),
  // Another imported file, a scene or a mesh, draws nothing here.
  [IMPORTED_FILE]: ({ address }) =>
    address && isTexturePath(address) ? { form: 'file', path: address } : null,
};
