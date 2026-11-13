/**
 * Cuts the cell of a decoded `AtlasTexture` out of its sheet as its own texture, so a region from
 * a scene and from a file shares one crop and cache.
 */

import type * as THREE from 'three';
import { proceduralTexture, proceduralTextureKey } from '../proceduralTextureCache';
import { imageSize } from '../../formats/image/imagePixels';
import { atlasTextureLayout } from './decode';
import { rasterizeAtlasTexture } from './build';
import { isLiveTarget, liveTargetCrop } from '../../../r3f/liveTargets';
import { pinColorSpace } from '../textureView';
import type { AtlasTextureData } from './types';

/**
 * A cropped cell, shared between the readers that cut it alike: a caller never disposes it. A cell
 * of a loaded sheet stays while a reader pins `key`, and a cell of a live target while a reader
 * holds `texture` (`holdUntilReleased`), where `key` is null. `useTexture2D` does both.
 */
interface AtlasTextureResolution {
  texture: THREE.Texture;
  key: string | null;
}

/**
 * `atlas`'s cell cut out of `sheet`, or null: an undecoded sheet, an empty region, or no canvas. A
 * loaded sheet is cut once for each decoded `atlas`, and `proceduralTexture` does not cache a null,
 * so the next render retries. The key includes the sheet's identity, so a reloaded sheet re-cuts. A live target is
 * cut after each of its renders, as Godot's AtlasTexture draws from the live RID.
 */
export function resolveAtlasTexture(
  atlas: AtlasTextureData,
  sheet: THREE.Texture | null
): AtlasTextureResolution | null {
  if (!sheet) return null;
  const layout = atlasTextureLayout(atlas, imageSize(sheet.image) ?? null);
  if (!layout) return null;
  if (isLiveTarget(sheet)) {
    // Pinned, as the sheet is: R3F reasserts `SRGBColorSpace` on a `map` every commit.
    const crop = pinColorSpace(liveTargetCrop(sheet, layout), sheet.colorSpace as THREE.ColorSpace);
    return { texture: crop, key: null };
  }

  const cacheId = `AtlasTexture@${sheet.uuid}`;
  const texture = proceduralTexture(atlas, cacheId, () => rasterizeAtlasTexture(sheet, layout));
  return texture ? { texture, key: proceduralTextureKey(atlas, cacheId) } : null;
}
