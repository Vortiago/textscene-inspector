/**
 * The bundled font as the canvas painter draws it: the bundled face a layout shapes with, turned
 * into the bundled canvas face, which draws each glyph from FreeType's bitmap of its outline
 * (ADR-0065).
 */
import { useCallback } from 'react';
import { withVariation, type FontMetrics } from './fontMetrics';
import { OPEN_SANS_CANVAS_FONT_METRICS } from './openSansCanvasFontMetrics';
import type { CanvasFontMetrics } from './runtimeFontMetrics';
import { peekOutlines } from './sceneFontOutlines';
import { BUNDLED_FACE } from './sceneFontResolution';
import { useProjectSettings } from '../../../contexts/ProjectSettingsContext';
import type { FontHinting } from '../../../../godot/text/textServerEnums';

/**
 * The bundled canvas face carrying the variation of `bundledFace`, with the outlines FreeType loads
 * at the default font's hinting, and emboldens and shears. Undefined while the outlines load, and
 * null where they cannot be read: the outline reader has warned, and no text of the face draws.
 */
export type PeekBundledCanvasFace = (bundledFace: FontMetrics) => CanvasFontMetrics | null | undefined;

/** The peek of the bundled canvas face, at the hinting the project gives the default font. */
export function useBundledCanvasFace(): PeekBundledCanvasFace {
  const { defaultFontHinting } = useProjectSettings();
  return useCallback(
    (bundledFace) => peekBundledCanvasFace(bundledFace, defaultFontHinting),
    [defaultFontHinting]
  );
}

function peekBundledCanvasFace(
  bundledFace: FontMetrics,
  hinting: FontHinting
): CanvasFontMetrics | null | undefined {
  const outlines = peekOutlines(BUNDLED_FACE, { hinting, isAutohinterForced: false });
  if (!outlines) return outlines;
  return withVariation(OPEN_SANS_CANVAS_FONT_METRICS, {
    embolden: bundledFace.embolden,
    skew: bundledFace.skew,
    opentype: bundledFace.opentype,
    outlines,
  });
}
