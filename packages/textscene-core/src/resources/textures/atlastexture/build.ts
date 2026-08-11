/**
 * Compose an `AtlasTexture`'s layout into a texture of its OWN size.
 *
 * Godot presents an AtlasTexture to every consumer as a texture whose size is
 * the region's, drawing the sheet's sub-rectangle wherever the texture is drawn
 * (`AtlasTexture::draw`, `scene/resources/atlas_texture.cpp:158-164`, and
 * `get_image` :245-256, which materialises exactly this crop). Producing that
 * crop as a real texture is what lets a windowed sheet reach EVERY Texture2D
 * slot: consumers read `image.width`/`image.height` for their sizing and set
 * their own `repeat`/`offset` for their own cropping, so a shared sheet handed
 * over with pre-windowed UVs would be silently re-windowed to the whole sheet.
 *
 * The copy is a whole-texel blit with smoothing off, so a 1:1 draw of the crop
 * is byte-identical to a 1:1 draw of the same texels through the sheet.
 */

import * as THREE from 'three';
import { imageSize } from '../../../r3f/controls/withImageCanvas';
import type { AtlasTextureLayout } from './types';

/**
 * The crop `layout` describes, drawn from the decoded atlas `image`, or null
 * when it cannot be produced: an image that has not decoded, a region that
 * misses the atlas entirely, or an environment with no 2D canvas (node and
 * happy-dom tests). Null is deliberately NOT "draw the sheet instead" — a
 * consumer showing the whole sprite sheet reads as a pass while being the
 * exact failure this module exists to prevent.
 */
export function rasterizeAtlasTexture(
  image: unknown,
  layout: AtlasTextureLayout
): THREE.CanvasTexture | null {
  const atlas = imageSize(image);
  if (!atlas) return null;

  // Godot intersects the sampled rect with the atlas
  // (`get_rect_region` :208) and draws nothing when the result is empty
  // (:209-211). Clipping the source shifts the destination by the same amount,
  // leaving the uncovered part of the box transparent.
  const left = Math.max(layout.source.x, 0);
  const top = Math.max(layout.source.y, 0);
  const right = Math.min(layout.source.x + layout.source.width, atlas.width);
  const bottom = Math.min(layout.source.y + layout.source.height, atlas.height);
  const sw = right - left;
  const sh = bottom - top;
  if (sw <= 0 || sh <= 0) return null;

  const doc = globalThis.document;
  if (!doc) return null;
  try {
    const canvas = doc.createElement('canvas');
    canvas.width = layout.width;
    canvas.height = layout.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      image as CanvasImageSource,
      left,
      top,
      sw,
      sh,
      layout.dest.x + (left - layout.source.x),
      layout.dest.y + (top - layout.source.y),
      sw,
      sh
    );

    const texture = new THREE.CanvasTexture(canvas);
    // The same tag `createTextureFromBuffer` puts on a loaded image: these are
    // the sheet's own undecoded sRGB bytes, and consumers that need another
    // colour space retag their own clone.
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  } catch {
    return null; // tainted canvas / unsupported image source
  }
}
