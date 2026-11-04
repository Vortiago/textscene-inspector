/**
 * What FreeType's auto-hinter reads of a face (`afglobal.h`, `aftypes.h`): the unscaled glyphs, the
 * character map, the layout tables, the style each glyph takes, and the scale of one load. Every
 * writing system's metrics start from `StyleMetrics`.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 2003-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { FIXED_16_16_ONE } from '../fontMetrics';
import type { UnscaledOutlines } from '../glyphContours';
import { AUTOFIT_SCRIPTS } from './afScripts';
import { AUTOFIT_STYLES, type AutofitStyle } from './afStyles';
import { shapeCluster, type ShapedGlyph, type ShapingFace } from './openTypeShaping';

/** The face's unscaled outlines with what the auto-hinter reads of its character map and style. */
export interface AutofitFace extends ShapingFace, UnscaledOutlines {
  /** `FT_STYLE_FLAG_ITALIC`, from `OS/2` or `head`. */
  readonly isItalic: boolean;
  /** The code points the Unicode `cmap` maps, ascending, as `FT_Get_Next_Char` walks them. */
  readonly codePoints: readonly number[];
}

/** `AF_ScalerRec`: the 16.16 scales and 26.6 offsets of one load, and the size's ppem. */
export interface Scaler {
  xScale: number;
  yScale: number;
  xDelta: number;
  yDelta: number;
  ppem: number;
}

/**
 * The bits of a glyph's entry in `glyphStyles` (`afglobal.h`). FreeType's cmap and digit bits are
 * left out: only the advance reads the digit bit, and nothing reads the cmap bit.
 */
export const GlyphStyle = {
  MASK: 0x1fff,
  UNASSIGNED: 0x1fff,
  NONBASE: 0x4000,
} as const;

/** `AF_STYLE_NONE_DFLT`: the dummy style, which leaves a glyph unhinted. */
export const NONE_STYLE = AUTOFIT_STYLES.findIndex((style) => style.name === 'none_dflt');

/** `AF_FaceGlobalsRec`: the face and the style of each glyph. */
export interface FaceGlobals {
  readonly face: AutofitFace;
  readonly glyphStyles: Uint16Array;
}

/** `AF_StyleMetricsRec`: what every writing system's metrics hold. */
export interface StyleMetrics {
  readonly style: AutofitStyle;
  readonly styleIndex: number;
  readonly globals: FaceGlobals;
  readonly scaler: Scaler;
}

export const newScaler = (): Scaler => ({
  xScale: FIXED_16_16_ONE,
  yScale: FIXED_16_16_ONE,
  xDelta: 0,
  yDelta: 0,
  ppem: 0,
});

/** The clusters of a blue or standard string: the runs between its spaces. */
export const clustersOf = (characters: string): string[] =>
  characters.split(' ').filter((cluster) => cluster !== '');

/**
 * `af_shaper_get_cluster_hb` and `af_shaper_get_elem_hb`: the glyphs of `cluster` under the
 * style's script and feature, the script HarfBuzz guesses from the style's own characters. A
 * style with a feature gets none for a cluster its feature leaves as it is.
 */
export function shapeStyleCluster(metrics: StyleMetrics, cluster: string): ShapedGlyph[] {
  const { face } = metrics.globals;
  const { coverage } = metrics.style;
  const scriptTags = AUTOFIT_SCRIPTS[metrics.style.script]!.openTypeTags;
  const shaped = shapeCluster(face, cluster, scriptTags, coverage);
  if (coverage === null) return shaped;
  const plain = shapeCluster(face, cluster, scriptTags, null);
  const isUnchanged =
    plain.length === shaped.length && plain.every((glyph, i) => glyph.glyph === shaped[i]!.glyph);
  return isUnchanged ? [] : shaped;
}
