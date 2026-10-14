/**
 * Resolves an `ImageTexture3D` sub-resource, whose `_images` hold its slices inline, to a
 * `THREE.Data3DTexture`, rows from the top as every density texture runs.
 */

import * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { arrayLiteralBody } from '../../../godot/variantParser.js';
import { splitTopLevel } from '../../../godot/index.js';
import { resolveSubResourceRef } from '../../SubResourceResolver';
import { dataTexture3D } from '../dataTexture3D';
import { decodeImage, type DecodedImage } from '../image/decode';
import {
  resolveProceduralSubResource,
  type ProceduralTextureResolution,
} from '../resolveProceduralSubResource';
import { stackSlices } from './texels';

export function resolveImageTexture3D(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): ProceduralTextureResolution<THREE.Data3DTexture> | null {
  return resolveProceduralSubResource(ref, internalResources, 'ImageTexture3D', build);
}

/**
 * Null when an image fails to decode or the formats differ, which `_set_images` refuses
 * (`scene/resources/image_texture.cpp:487`).
 */
function build(
  properties: Record<string, string>,
  resources: readonly TscnInternalResource[]
): THREE.Data3DTexture | null {
  const images = savedImages(properties._images, resources);
  if (!images || new Set(images.map(({ format }) => format)).size > 1) return null;
  const volume = stackSlices(images);
  if (!volume) return null;
  return dataTexture3D(volume.texels, volume.width, volume.height, volume.depth, THREE.RGBAFormat);
}

/**
 * The `Image` sub-resources `_images` names, decoded, in order. Null when any element names no
 * Image or one `decodeImage` declines.
 */
function savedImages(
  value: string | undefined,
  resources: readonly TscnInternalResource[]
): DecodedImage[] | null {
  const body = value ? arrayLiteralBody(value) : null;
  if (body === null) return null;
  const images: DecodedImage[] = [];
  for (const element of splitTopLevel(body)) {
    if (element === '') continue;
    const image = resolveSubResourceRef(element, resources);
    const decoded = image?.type === 'Image' ? decodeImage(image.data) : null;
    if (!decoded) return null;
    images.push(decoded);
  }
  return images;
}
