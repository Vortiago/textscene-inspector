/**
 * The bundled font as the canvas painter draws it: the bundled face a layout shapes with, turned
 * into the bundled canvas face, which draws each glyph from FreeType's bitmap of its outline
 * (ADR-0069).
 */
import { useCallback } from 'react';
import { withVariation, type FontMetrics } from './fontMetrics';
import { OPEN_SANS_CANVAS_FONT_METRICS } from './openSansCanvasFontMetrics';
import type { CanvasFontMetrics } from './runtimeFontMetrics';
import { peekOutlines } from './sceneFontOutlines';
import { BUNDLED_FACE } from './sceneFontResolution';
import { useProjectSettings } from '../../../contexts/ProjectSettingsContext';
import type { SettledFonts } from './settledFonts';
import { useWatchedSettledFonts } from './useSettledFont';
import type { FontHinting } from '../../../../godot/text/textServerEnums';

/**
 * The bundled canvas face carrying the variation of `bundledFace`, with the outlines FreeType loads
 * at the default font's hinting, and emboldens and shears. Undefined while the outlines or the
 * project settings load, and null where the outlines cannot be read: the outline reader has
 * warned, and no text of the face draws.
 */
export type PeekBundledCanvasFace = (bundledFace: FontMetrics) => CanvasFontMetrics | null | undefined;

/**
 * The peek of the bundled canvas face, at the hinting the project gives the default font. It
 * answers undefined while the project settings load, so no outline loads at a hinting they replace.
 */
export function useBundledCanvasFace(): PeekBundledCanvasFace {
  const { defaultFontHinting, isSettled } = useProjectSettings();
  // Watched, so a face read while the outlines load renders again once they settle.
  const fonts = useWatchedSettledFonts();
  return useCallback(
    (bundledFace) => (isSettled ? peekBundledCanvasFace(fonts, bundledFace, defaultFontHinting) : undefined),
    [fonts, defaultFontHinting, isSettled]
  );
}

function peekBundledCanvasFace(
  fonts: SettledFonts,
  bundledFace: FontMetrics,
  hinting: FontHinting
): CanvasFontMetrics | null | undefined {
  const outlines = peekOutlines(fonts, BUNDLED_FACE, { hinting, isAutohinterForced: false });
  if (!outlines) return outlines;
  return withVariation(OPEN_SANS_CANVAS_FONT_METRICS, {
    embolden: bundledFace.embolden,
    skew: bundledFace.skew,
    opentype: bundledFace.opentype,
    outlines,
  });
}
