/**
 * The font a TextMesh builds from, as far as it has loaded: the outlines it extrudes and
 * the metrics that shape its lines. The font file, its outlines and its metrics all arrive after the scene.
 */

import { peekSettledSceneFontMetrics } from '../../../r3f/controls/native/text/sceneFontLoader';
import { peekSceneFontOutlines } from '../../../r3f/controls/native/text/sceneFontOutlines';
import { withOutlines } from '../../../r3f/controls/native/text/fontMetrics';
import { identityKey } from '../../../utils/identityKey';
import { perObject } from '../../../utils/perObject';
import { resolveFontReference } from '../../fonts/font/resolveFontReference';
import { fontForNode } from '../../styles/theme/lookup';
import type { LoadedFont, ResolvableResource, ScopedResource } from '../../scopedResource';
import type { TextMeshFace } from './build';

export type TextMeshFont =
  /** A SystemFont, or a font without outlines this reader parses: Godot draws it, this previewer cannot. */
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
  const outlines = peekSceneFontOutlines(font);
  if (outlines === null) return UNREADABLE;
  // The settled metrics are keyed by the resolved font file, and the name only labels a failure.
  const metrics = peekSettledSceneFontMetrics(font, `TextMesh ${resource.id}`);
  return outlines && metrics ? { status: 'ready', face: withOutlines(metrics, outlines) } : AWAITING_FONT;
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
  return String(identityKey(font.face));
}
