/**
 * The Font kind of the reading module: one decode of a Font for every origin. The font processor
 * reads a font file whole, with its import sidecar and the fonts it names, so a Font in a file is
 * the processor's value, and a Font built into a scene decodes from its text.
 */

import { FONT_FILES } from '../../fileKinds';
import type { Follow, HeldResource, ResourceKind } from '../../reading/read';
import { extractResourceRefs, FONT_SUB_RESOURCE_TYPES, fontResourceOf } from './decode';
import type { FontResource } from './types';

/**
 * The classes a Font property accepts: the three this slice decodes, and `Font`, the class an
 * `[ext_resource]` may state for any of them.
 */
const FONT_CLASSES: ReadonlySet<string> = new Set([...FONT_SUB_RESOURCE_TYPES, 'Font']);

/** @canonical A Font a property names, from a scene or from a file */
export const FONT: ResourceKind<FontResource> = {
  name: 'Font',
  accepts: (type) => FONT_CLASSES.has(type),
  readsFilesWhole: true,
  decode: (held, follow) =>
    held.address === null ? fontOfText(held, follow) : follow.loaded(FONT_FILES).value,
};

/**
 * A Font built into a scene. A base font or a fallback that names nothing, fails or loops reads as
 * none, as `Font::_update_rids_fb` skips a null one (`font.cpp:103-116`). A fallback still loading
 * reads as none too, so the text draws in the base face until it arrives and the decode runs again.
 */
function fontOfText({ type, properties }: HeldResource, follow: Follow): FontResource | null {
  if (!FONT_SUB_RESOURCE_TYPES.has(type)) return null;
  const fallbacks = extractResourceRefs(properties['fallbacks'] ?? '')
    .map((ref) => follow.readWithoutWaiting(FONT, ref).value)
    .filter((font) => font !== null);
  const baseFont = type === 'FontVariation' ? follow.read(FONT, properties['base_font']).value : null;
  return fontResourceOf(type, properties, fallbacks, baseFont);
}
