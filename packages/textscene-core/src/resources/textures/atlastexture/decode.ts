/**
 * AtlasTexture decode — an `AtlasTexture` section's raw properties into "which
 * sheet, which window".
 *
 * `atlas = ExtResource("2")` names the sheet and `region = Rect2(x, y, w, h)`
 * the cell. The atlas REF STAYS RAW here, the same rule SpriteFrames' frame refs
 * follow: resolving it needs the owning file's ExtResource table, and keeping
 * that out makes this a leaf module — which is what lets
 * `SubResourceResolver.resolveTexture2DSource` (the shared resolver every
 * Texture2D slot goes through) call the decode without an import cycle.
 *
 * A zero-area region means "the whole image", not "an empty texture": Godot's
 * `AtlasTexture::get_width`/`get_height` fall back to the atlas dimensions when
 * the region size is 0 (`scene/resources/atlas_texture.cpp:33-53`). A negative
 * size has no Godot rendering either, so it takes the same lenient answer.
 *
 * The Rect2 grammar is the shared canonical reader's, so a malformed component
 * (`1.2.3`, `1e-`, a double sign) fails the whole match and leaves the frame
 * un-windowed, instead of the NaN a loose `[\d.eE+-]+` copy used to store.
 *
 * Pure `.ts`, no THREE — `build.ts` applies the window to a loaded image.
 */

import { parseOptionalRect2 } from '../../../parser/valueParsers';
import type { AtlasRegion, AtlasTextureData } from './types';

export function decodeAtlasTexture(properties: Record<string, unknown>): AtlasTextureData {
  const atlas = typeof properties.atlas === 'string' ? properties.atlas : null;
  const region = parseAtlasRegion(
    typeof properties.region === 'string' ? properties.region : undefined
  );
  return region ? { atlas, region } : { atlas };
}

/**
 * `Rect2(x, y, w, h)` → a region, or null when absent, malformed, or empty.
 * The grammar is the shared reader's; the zero-size rule stays here because it
 * is Godot's ATLAS semantics (a zero-size region samples the whole sheet,
 * atlas_texture.cpp:33-53), not part of the Rect2 form.
 */
export function parseAtlasRegion(value: string | undefined): AtlasRegion | null {
  const rect = parseOptionalRect2(value, 'AtlasTexture region');
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
  return rect;
}
