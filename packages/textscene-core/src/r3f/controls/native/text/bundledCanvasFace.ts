/**
 * The bundled font as the canvas painter draws it: a bundled atlas face turned into the bundled
 * canvas face, which draws each glyph from FreeType's bitmap of its outline (ADR-0040).
 */
import { useCallback } from 'react';
import { peekBundledCanvasFontMetrics } from './bundledFontLoader';
import { withVariation, type FontMetrics } from './fontMetrics';
import type { CanvasFontMetrics } from './runtimeFontMetrics';
import { peekOutlines } from './sceneFontOutlines';
import { BUNDLED_FACE } from './sceneFontResolution';
import { useProjectSettings } from '../../../contexts/ProjectSettingsContext';
import type { FontHinting } from '../../../../godot/text/textServerEnums';

/**
 * The bundled canvas face carrying the variation of `atlasFace`, with the outlines FreeType loads
 * at the default font's hinting, and emboldens and shears. Undefined while the face or its outlines
 * load, and null when the face cannot register.
 */
export type PeekBundledCanvasFace = (atlasFace: FontMetrics) => CanvasFontMetrics | null | undefined;

/** The peek of the bundled canvas face, at the hinting the project gives the default font. */
export function useBundledCanvasFace(): PeekBundledCanvasFace {
  const { defaultFontHinting } = useProjectSettings();
  return useCallback(
    (atlasFace) => peekBundledCanvasFace(atlasFace, defaultFontHinting),
    [defaultFontHinting]
  );
}

function peekBundledCanvasFace(
  atlasFace: FontMetrics,
  hinting: FontHinting
): CanvasFontMetrics | null | undefined {
  const bundled = peekBundledCanvasFontMetrics();
  if (!bundled) return bundled;
  const outlines = peekOutlines(BUNDLED_FACE, { hinting, isAutohinterForced: false });
  if (outlines === undefined) return undefined;
  // Null is a font this reader cannot open, which draws its text.
  return withVariation(bundled, {
    embolden: atlasFace.embolden,
    skew: atlasFace.skew,
    opentype: atlasFace.opentype,
    outlines: outlines ?? undefined,
  });
}
