/**
 * The font a TextMesh builds from, as far as it has loaded: the outlines it extrudes and
 * the metrics that shape its lines. The font file, its outlines and its metrics all arrive after the scene.
 * A BMFont shapes from its descriptor and has no outlines (`bitmapFontOutlines.ts`), so only a hex-code box draws.
 */

import {
  peekSettledChainFaces,
  type SettledChainFace,
} from '../../../r3f/controls/native/text/sceneFontLoader';
import { peekSceneFontOutlines } from '../../../r3f/controls/native/text/sceneFontOutlines';
import { withOutlines } from '../../../r3f/controls/native/text/fontMetrics';
import { identityKey } from '../../../utils/identityKey';
import { perObject } from '../../../utils/perObject';
import { resolveFontReference } from '../../fonts/font/resolveFontReference';
import { fontForNode } from '../../styles/theme/lookup';
import type { LoadedFont, ResolvableResource, ScopedResource } from '../../scopedResource';
import type { TextMeshChain, TextMeshFace } from './build';

export type TextMeshFont =
  /** A font whose outlines this reader cannot open: Godot draws it, this previewer cannot. */
  { status: 'unreadable' } | { status: 'awaitingFont' } | { status: 'ready'; chain: TextMeshChain };

const UNREADABLE: TextMeshFont = { status: 'unreadable' };
const AWAITING_FONT: TextMeshFont = { status: 'awaitingFont' };

/**
 * The font of `mesh`, as its `loadedFont` and the settled metrics answer now. A mesh object holds its
 * `loadedFont` for good, so a font it found unreadable or ready stays so. A font that awaits its
 * outlines or metrics is read again: they settle later.
 */
export const textMeshFont = perObject(readTextMeshFont, {
  keeps: (font) => font.status !== 'awaitingFont',
});

function readTextMeshFont({
  resource,
  resources,
  loadedFont,
  projectFonts,
}: ResolvableResource): TextMeshFont {
  const font = fontForNode('TextMesh', resource.data['font'], { resources, loadedFont, projectFonts });
  // The settled metrics are keyed by the resolved font file, and the name only labels a failure.
  const faces = peekSettledChainFaces(font, `TextMesh ${resource.id}`);
  // Peeked before the metrics settle, so a font with no outlines is unreadable at once.
  if (peekSceneFontOutlines(faces?.[0]?.font ?? font) === null) return UNREADABLE;
  const [face, ...fallbacks] = faces?.map(faceWithOutlines) ?? [undefined];
  if (!face || fallbacks.includes(undefined)) return AWAITING_FONT;
  const readable = fallbacks.filter((fallback): fallback is TextMeshFace => fallback !== null);
  return { status: 'ready', chain: [face, ...readable] };
}

/**
 * A face with the outlines it extrudes: undefined while they load, and null for outlines this reader
 * cannot open, which drops a fallback from the chain.
 */
function faceWithOutlines({ font, metrics }: SettledChainFace): TextMeshFace | null | undefined {
  const outlines = peekSceneFontOutlines(font);
  return outlines ? withOutlines(metrics, outlines) : outlines;
}

/** The font files the `font` of `scoped` names, which the build reads once they load. */
export function textMeshFontFiles({ resource, resources }: ScopedResource, loadedFont: LoadedFont): string[] {
  return resolveFontReference(resource.data['font'], resources, loadedFont).paths;
}

/**
 * A key over the font a build reads: a reload that parses a new font file takes a new key, and so
 * does metrics that settle.
 */
export function textMeshFontKey(font: TextMeshFont): string {
  if (font.status !== 'ready') return font.status;
  return font.chain.map(identityKey).join(',');
}
