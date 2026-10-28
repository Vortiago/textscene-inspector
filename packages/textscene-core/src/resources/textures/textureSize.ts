/**
 * The size Godot reports for a drawn texture, which a sized canvas consumer lays out by. No React.
 */

import type * as THREE from 'three';
import { imageSize, type ImageSize } from '../formats/image/imagePixels';
import { isUnconfiguredViewportTexture } from './viewporttexture/unconfiguredViewportTexture';

const NO_AREA: ImageSize = { width: 0, height: 0 };

/**
 * The texture's image size, or 0 by 0 for a ViewportTexture its scene never sets up, which still
 * samples the placeholder (`viewport.cpp:134-166`). Undefined for no texture, or one with no image yet.
 *
 * @canonical The size Godot reports for a drawn texture
 */
export function textureSize(texture: THREE.Texture | null | undefined): ImageSize | undefined {
  if (!texture) return undefined;
  return isUnconfiguredViewportTexture(texture) ? NO_AREA : imageSize(texture.image);
}
