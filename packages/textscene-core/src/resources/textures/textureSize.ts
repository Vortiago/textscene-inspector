/**
 * The size Godot reports for a drawn texture, which a sized canvas consumer lays out by. No React.
 */

import type * as THREE from 'three';
import type { Vector2 } from '../../godot/math/vector';
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

/**
 * `textureSize` as a Vector2, or null for no texture and for one of no area, which a sized consumer
 * neither draws nor makes room for (`button.cpp:369`).
 *
 * @canonical The size Godot reports for a drawn texture
 */
export function reportedArea(texture: THREE.Texture | null | undefined): Vector2 | null {
  return sizeWithArea(textureSize(texture));
}

/** `size` as a Vector2, or null for no size and for one of no area. */
export function sizeWithArea(size: ImageSize | undefined): Vector2 | null {
  return size && size.width > 0 && size.height > 0 ? { x: size.width, y: size.height } : null;
}
