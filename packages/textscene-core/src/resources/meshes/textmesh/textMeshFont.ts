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
import { withFallbacks, withOutlines } from '../../../r3f/controls/native/text/fontMetrics';
import { identityKey } from '../../../utils/identityKey';
import { perObject } from '../../../utils/perObject';
import { resolveFontReference } from '../../fonts/font/resolveFontReference';
import { fontForNode } from '../../styles/theme/lookup';
import type { LoadedFont, ResolvableResource, ScopedResource } from '../../scopedResource';
import type { TextMeshFace } from './build';

export type TextMeshFont =
  /** A font whose outlines this reader cannot open: Godot draws it, this previewer cannot. */
  { status: 'unreadable' } | { status: 'awaitingFont' } | { status: 'ready'; face: TextMeshFace };

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
  const primaryOutlines = peekSceneFontOutlines(faces?.[0]?.font ?? font);
  if (primaryOutlines === null) return UNREADABLE;
  if (!faces || !primaryOutlines) return AWAITING_FONT;
  const fallbacks = faces.slice(1).map(faceWithOutlines);
  if (fallbacks.includes(undefined)) return AWAITING_FONT;
  const face = withOutlines(faces[0]!.metrics, primaryOutlines);
  const readable = fallbacks.filter((fallback): fallback is TextMeshFace => !!fallback);
  return { status: 'ready', face: withFallbacks(face, readable) };
}

/**
 * A fallback face with the outlines it extrudes: undefined while they load, and null for outlines this
 * reader cannot open, which drops the face from the chain.
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
  return `${identityKey(font.face)}`;
}
