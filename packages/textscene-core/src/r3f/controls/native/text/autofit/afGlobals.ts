/**
 * The auto-hinter's globals of a face (`afglobal.c`): the style each glyph takes, from the
 * character ranges of each script and the OpenType features of each style, and the hinter of each
 * style, made the first time a glyph of it loads.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 2003-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { ScaledOutline } from '../glyphContours';
import {
  GlyphStyle,
  newScaler,
  type AutofitFace,
  type FaceGlobals,
  type Scaler,
  type StyleMetrics,
} from './afFace';
import { newGlyphHints, reloadHints, saveHints, ScalerFlag, type GlyphHints } from './afHints';
import { applyLatinHints } from './afLatinHinting';
import { initLatinMetrics, scaleLatinMetrics } from './afLatinMetrics';
import { applyCjkHints } from './afCjkHinting';
import { initCjkMetrics, initIndicMetrics, scaleCjkMetrics, type CjkMetrics } from './afCjkMetrics';
import { AUTOFIT_SCRIPTS, rangePairs } from './afScripts';
import { AUTOFIT_STYLES, type AutofitStyle } from './afStyles';
import { collectGposInput, collectGsubOutput, wouldSubstitute } from './openTypeGlyphSets';
import { collectLookups } from './openTypeLayout';

/** A style's metrics with its writing system's steps (`AF_WritingSystemClassRec`). */
export interface StyleHinter {
  readonly metrics: StyleMetrics;
  /** The `AF_SCALER_FLAG_*` bits the style's hints take. */
  readonly scalerFlags: number;
  scale(scaler: Scaler): void;
  /** Hints `outline`, which holds `glyph` in font units, in place, scaling it. */
  apply(glyph: number, hints: GlyphHints, outline: ScaledOutline): void;
}

/**
 * `af_latin_hints_init` and its kin: the hints take the scales the style last scaled to, which the
 * Latin system fits to the x-height, and the style's scaler flags.
 */
export function initStyleHints(hints: GlyphHints, hinter: StyleHinter): void {
  const { xScale, xDelta, yScale, yDelta } = hinter.metrics.scaler;
  hints.xScale = xScale;
  hints.xDelta = xDelta;
  hints.yScale = yScale;
  hints.yDelta = yDelta;
  hints.scalerFlags = hinter.scalerFlags;
}

/** The default script (`AF_CONFIG_OPTION_DEFAULT_SCRIPT`), and Godot's fallback style, CJK's. */
const DEFAULT_SCRIPT = AUTOFIT_SCRIPTS.findIndex((script) => script.name === 'latn');
const FALLBACK_STYLE = AUTOFIT_STYLES.findIndex((style) => style.name === 'hani_dflt');
const DEFAULT_SCRIPT_TAG = 'DFLT';

function latinHinter(globals: FaceGlobals, styleIndex: number): StyleHinter | null {
  const metrics = initLatinMetrics(globals, styleIndex);
  if (!metrics) return null;
  return {
    metrics,
    scale: (scaler) => scaleLatinMetrics(metrics, scaler),
    // An italic face has no horizontal hinting.
    scalerFlags: metrics.globals.face.isItalic ? ScalerFlag.NO_HORIZONTAL : 0,
    apply: (glyph, hints, outline) => applyLatinHints(glyph, hints, outline, metrics),
  };
}

/** `af_cjk_writing_system_class`, and `af_indic_writing_system_class` with no blue zones. */
function cjkSystemHinter(metrics: CjkMetrics): StyleHinter {
  return {
    metrics,
    scale: (scaler) => scaleCjkMetrics(metrics, scaler),
    // The CJK systems leave the advance unhinted.
    scalerFlags: ScalerFlag.NO_ADVANCE,
    apply: (_, hints, outline) => applyCjkHints(hints, outline, metrics),
  };
}

/** `af_dummy_writing_system_class`: the outline only scales. */
function dummyHinter(globals: FaceGlobals, styleIndex: number): StyleHinter {
  const metrics: StyleMetrics = {
    style: AUTOFIT_STYLES[styleIndex]!,
    styleIndex,
    globals,
    scaler: newScaler(),
  };
  return {
    metrics,
    scale: (scaler) => Object.assign(metrics.scaler, scaler),
    scalerFlags: 0,
    apply: (_, hints, outline) => {
      reloadHints(hints, outline);
      saveHints(hints, outline);
    },
  };
}

const HINTERS = {
  dummy: dummyHinter,
  latin: latinHinter,
  cjk: (globals, styleIndex) => cjkSystemHinter(initCjkMetrics(globals, styleIndex)),
  indic: (globals, styleIndex) => cjkSystemHinter(initIndicMetrics(globals, styleIndex)),
} satisfies Record<
  AutofitStyle['writingSystem'],
  (globals: FaceGlobals, styleIndex: number) => StyleHinter | null
>;

/** The glyphs from `first` through `last` that `cmap` maps, as `FT_Get_Next_Char` walks them. */
function* mappedGlyphs(face: AutofitFace, first: number, last: number): Generator<number> {
  const { codePoints } = face;
  let low = 0;
  let high = codePoints.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (codePoints[mid]! < first) low = mid + 1;
    else high = mid;
  }
  for (let i = low; i < codePoints.length && codePoints[i]! <= last; i++)
    yield face.glyphIndex(codePoints[i]!);
}

/** The script tags `af_shaper_get_coverage_hb` collects under, the default script's own tag added for it. */
function coverageScriptTags(style: AutofitStyle, isDefaultScript: boolean): string[] | null {
  const tags = AUTOFIT_SCRIPTS[style.script]!.openTypeTags.slice(0, 3);
  if (!isDefaultScript) return tags[0] === DEFAULT_SCRIPT_TAG ? null : tags;
  if (tags.length === 0) return [DEFAULT_SCRIPT_TAG];
  if (tags.length === 1) return [tags[0]!, DEFAULT_SCRIPT_TAG];
  if (tags[1] !== DEFAULT_SCRIPT_TAG) tags[2] = DEFAULT_SCRIPT_TAG;
  return tags;
}

/** Whether a lookup of a feature style substitutes a character of its blue strings, which the style needs. */
function substitutesBlueCharacter(
  face: AutofitFace,
  style: AutofitStyle,
  lookups: readonly number[]
): boolean {
  const gsub = face.gsub!;
  for (const { characters } of style.blues) {
    for (const character of characters) {
      const glyph = face.glyphIndex(character.codePointAt(0)!);
      if (lookups.some((lookup) => wouldSubstitute(gsub, lookup, glyph))) return true;
    }
  }
  return false;
}

/**
 * `af_shaper_get_coverage_hb`: the glyphs the style's `GSUB` lookups put out, still unassigned,
 * take the style. A feature style needs the feature to change a blue character, and leaves out
 * the glyphs `GPOS` positions.
 */
function assignLayoutCoverage(globals: FaceGlobals, styleIndex: number, isDefaultScript: boolean): void {
  const { face, glyphStyles } = globals;
  const style = AUTOFIT_STYLES[styleIndex]!;
  const scriptTags = coverageScriptTags(style, isDefaultScript);
  if (!scriptTags || !face.gsub) return;
  const features = style.coverage === null ? null : [style.coverage];
  const gsubLookups = collectLookups(face.gsub, scriptTags, features);
  if (gsubLookups.length === 0) return;
  if (style.coverage !== null && !substitutesBlueCharacter(face, style, gsubLookups)) return;
  const glyphs = new Set<number>();
  for (const lookup of gsubLookups) collectGsubOutput(face.gsub, lookup, glyphs);
  if (style.coverage !== null && face.gpos) {
    const positioned = new Set<number>();
    for (const lookup of collectLookups(face.gpos, scriptTags, features))
      collectGposInput(face.gpos, lookup, positioned);
    for (const glyph of positioned) glyphs.delete(glyph);
  }
  for (const glyph of glyphs)
    if (glyph < glyphStyles.length && glyphStyles[glyph] === GlyphStyle.UNASSIGNED)
      glyphStyles[glyph] = styleIndex;
}

/** The first pass for a style of its script's own glyphs: the ones its ranges map, and those of them that sit on a base. */
function assignCmapCoverage(globals: FaceGlobals, styleIndex: number): void {
  const { face, glyphStyles } = globals;
  const script = AUTOFIT_SCRIPTS[AUTOFIT_STYLES[styleIndex]!.script]!;
  for (const [first, last] of rangePairs(script.ranges))
    for (const glyph of mappedGlyphs(face, first, last))
      if ((glyphStyles[glyph]! & GlyphStyle.MASK) === GlyphStyle.UNASSIGNED) glyphStyles[glyph] = styleIndex;
  for (const [first, last] of rangePairs(script.nonbaseRanges))
    for (const glyph of mappedGlyphs(face, first, last))
      if ((glyphStyles[glyph]! & GlyphStyle.MASK) === styleIndex)
        glyphStyles[glyph] = glyphStyles[glyph]! | GlyphStyle.NONBASE;
}

/** `af_face_globals_compute_style_coverage`. */
function glyphStylesOf(globals: FaceGlobals): void {
  const { glyphStyles } = globals;
  glyphStyles.fill(GlyphStyle.UNASSIGNED);
  let defaultStyle = -1;
  AUTOFIT_STYLES.forEach((style, index) => {
    if (style.coverage !== null) return assignLayoutCoverage(globals, index, false);
    if (style.script === DEFAULT_SCRIPT) defaultStyle = index;
    assignCmapCoverage(globals, index);
  });
  AUTOFIT_STYLES.forEach((style, index) => {
    if (style.coverage === null) assignLayoutCoverage(globals, index, false);
  });
  assignLayoutCoverage(globals, defaultStyle, true);
  for (let glyph = 0; glyph < glyphStyles.length; glyph++)
    if ((glyphStyles[glyph]! & GlyphStyle.MASK) === GlyphStyle.UNASSIGNED)
      glyphStyles[glyph] = (glyphStyles[glyph]! & ~GlyphStyle.MASK) | FALLBACK_STYLE;
}

/** The auto-hinter's state of one face: its globals and the hinter of each style it has loaded. */
export class AutofitGlobals implements FaceGlobals {
  readonly glyphStyles: Uint16Array;
  readonly hints: GlyphHints;
  private readonly hinters = new Map<number, StyleHinter>();

  constructor(readonly face: AutofitFace) {
    this.glyphStyles = new Uint16Array(face.glyphCount);
    this.hints = newGlyphHints(face.unitsPerEm);
    glyphStylesOf(this);
  }

  /** `af_face_globals_get_metrics`: a style that finds no blue zone hands the glyph to the dummy style. */
  hinterOf(glyph: number): StyleHinter {
    for (;;) {
      const styleIndex = this.glyphStyles[glyph]! & GlyphStyle.MASK;
      const cached = this.hinters.get(styleIndex);
      if (cached) return cached;
      const hinter = HINTERS[AUTOFIT_STYLES[styleIndex]!.writingSystem](this, styleIndex);
      if (!hinter) continue;
      this.hinters.set(styleIndex, hinter);
      return hinter;
    }
  }
}
