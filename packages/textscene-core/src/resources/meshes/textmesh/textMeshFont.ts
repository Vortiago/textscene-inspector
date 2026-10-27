/**
 * The font a TextMesh builds from, as far as it has loaded: the outlines it extrudes and
 * the metrics that shape its lines. The font file and its metrics both arrive after the scene.
 */

import { peekSettledSceneFontMetrics } from '../../../r3f/controls/native/text/sceneFontLoader';
import { identityKey } from '../../../utils/identityKey';
import { perObject } from '../../../utils/perObject';
import { resolveFontReference } from '../../fonts/font/resolveFontReference';
import type { LoadedFont, ResolvableResource, ScopedResource } from '../../scopedResource';
import type { TextMeshFace } from './build';
import { fontOutlines } from './fontOutlines';

export type TextMeshFont =
  /** No font, a font not loaded, or one without outlines this reader parses: Godot draws it, this previewer cannot. */
  { status: 'unreadable' } | { status: 'awaitingMetrics' } | { status: 'ready'; face: TextMeshFace };

const UNREADABLE: TextMeshFont = { status: 'unreadable' };
const AWAITING_METRICS: TextMeshFont = { status: 'awaitingMetrics' };

/**
 * The font of `mesh`, as its `loadedFont` and the settled metrics answer now. A mesh object holds its
 * `loadedFont` for good, so a font it found unreadable or ready stays so. A font that awaits its
 * metrics is read again: they settle later.
 */
export const textMeshFont = perObject(readTextMeshFont, {
  keeps: (font) => font.status !== 'awaitingMetrics',
});

function readTextMeshFont({ resource, resources, loadedFont }: ResolvableResource): TextMeshFont {
  const { font } = resolveFontReference(resource.data['font'], resources, loadedFont);
  const outlines = fontOutlines(font);
  if (!outlines) return UNREADABLE;
  // The settled metrics are keyed by the resolved font file, and the name only labels a failure.
  const metrics = peekSettledSceneFontMetrics(font, `TextMesh ${resource.id}`);
  return metrics ? { status: 'ready', face: { outlines, metrics } } : AWAITING_METRICS;
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
  return `${identityKey(font.face.outlines)}/${identityKey(font.face.metrics)}`;
}
