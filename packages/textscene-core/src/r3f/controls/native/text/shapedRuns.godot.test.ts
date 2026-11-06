/**
 * The glyphs a run of characters shapes into, against Godot 4.6.3: `shapedRuns.godot.json` holds the
 * glyphs Godot's shaper gives each text, with each glyph's cluster, advance and offset
 * (`scripts/fonts/shaped-runs-oracle`). The rows cover a base and marks typed as separate characters,
 * the ligatures of Montserrat and of the default theme font, and a contextual `rvrn` rule at the
 * instances of `recursive-contextual-rvrn.woff2` (`scripts/fonts/contextual-rvrn`).
 */
import { describe, expect, it } from 'vitest';
import reference from './shapedRuns.godot.json';
import { withVariation, type FontMetrics } from './fontMetrics';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { openFontContainer } from './fontContainer';
import { opentypeOf } from './glyphVariation.testkit';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import { sfntRunSubstitutions } from './glyphRun';
import { sfntGlyphIndex, sfntHasGlyph } from './sfntCmap';
import { sfntDecomposition } from './sfntDecomposition';
import { glyphMetricsReader } from './sfntGlyphMetrics';
import { openFontOutlines } from './sfntOutlines';
import { fixtureFontBytes } from './sfntOutlines.testkit';
import { fileBytes } from '../../../../resources/testing/fileBytes';
import { OUTLINE_TABLE_TAGS, parseSfntScalars, type SfntFile } from './sfntTables';
import { shapeText, type GlyphPlacement } from './textLayout';
import { readFvarAxes } from './variation/fvar';
import { instanceKerningReader } from './variation/instanceKerning';
import { join } from 'node:path';

interface ReferenceGlyph {
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly advance: number;
  readonly offset: readonly [number, number];
}

interface ReferenceRun {
  readonly font: string;
  readonly text: string;
  readonly sizePx: number;
  readonly opentype: Record<string, number>;
  readonly glyphs: readonly ReferenceGlyph[];
}

/** The glyphs of one cluster: Godot gives each glyph of a cluster the cluster's `[start, end)`. */
interface ReferenceCluster {
  readonly start: number;
  readonly end: number;
  readonly glyphs: readonly ReferenceGlyph[];
}

const BUNDLED_FONT = 'OpenSans_SemiBold.woff2';

const bytesOf = (font: string): ArrayBuffer =>
  font === BUNDLED_FONT
    ? fileBytes(join(import.meta.dirname, '../../../../../assets/fonts', font))
    : fixtureFontBytes(font);

async function sfntOf(font: string): Promise<SfntFile> {
  const sfnt = await openFontContainer(bytesOf(font), OUTLINE_TABLE_TAGS);
  if (!sfnt) throw new Error(`expected ${font} to open, got null`);
  return sfnt;
}

/**
 * A face that reads every number of `font` from its tables. The scene-font loader's face measures its
 * kerning on a canvas, which carries the same `GPOS` pairs.
 */
async function sfntFaceOf(font: string): Promise<FontMetrics> {
  const sfnt = await sfntOf(font);
  const { unitsPerEm, ascent, descent } = parseSfntScalars(sfnt)!;
  const glyphIndexOf = sfntGlyphIndex(sfnt)!;
  const metricsOf = glyphMetricsReader(sfnt);
  const advanceUnits = (ch: string) => metricsOf(glyphIndexOf(ch.codePointAt(0)!), 0).horizontal.advance;
  const kerningOf = instanceKerningReader(sfnt)?.(new Int32Array(readFvarAxes(sfnt)?.length ?? 0));
  const substitutions = sfntRunSubstitutions(sfnt) ?? undefined;
  // The kerning of a cluster's text is the kerning of the glyph the text shapes into.
  const lookupGlyph = (text: string) => {
    const chars = [...text];
    const [cluster] = substitutions?.(chars) ?? [];
    const codePoint = text.codePointAt(0)!;
    const isWhole = cluster?.start === 0 && cluster.end === chars.length;
    return { glyph: isWhole ? cluster.glyph : glyphIndexOf(codePoint), codePoint };
  };
  return {
    kind: 'canvas',
    unitsPerEm,
    ascent,
    descent,
    hasGlyph: sfntHasGlyph(sfnt),
    getGlyphAdvanceUnits: advanceUnits,
    getKerningAdjustmentUnits: (a, b) => kerningOf?.(lookupGlyph(a), lookupGlyph(b)) ?? 0,
    averageAdvanceUnits: advanceUnits('n'),
    decomposition: sfntDecomposition(sfnt) ?? undefined,
    substitutions,
  };
}

async function faceAt(row: ReferenceRun): Promise<FontMetrics> {
  const face = await sfntFaceOf(row.font);
  const opentype = opentypeOf(row.opentype);
  if (!opentype?.size) return face;
  const outlines = await openFontOutlines(bytesOf(row.font));
  return withVariation(face, { opentype, outlines: outlines ?? undefined });
}

function clustersOf(glyphs: readonly ReferenceGlyph[]): ReferenceCluster[] {
  const clusters: ReferenceCluster[] = [];
  for (const glyph of glyphs) {
    const last = clusters.at(-1);
    if (last?.start === glyph.start) (last.glyphs as ReferenceGlyph[]).push(glyph);
    else clusters.push({ start: glyph.start, end: glyph.end, glyphs: [glyph] });
  }
  return clusters;
}

function placementsOf(text: string, sizePx: number, fontMetrics: FontMetrics): GlyphPlacement[] {
  return shapeText(text, {
    fontSizePx: sizePx,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 0,
    fontMetrics,
  }).lines[0]!.glyphs;
}

/** What Godot draws for one cluster, in the shape the layout gives it: a glyph, its pen and each mark's offset. */
interface DrawnCluster {
  start: number;
  end: number;
  glyph: number;
  x: number;
  /** How far the glyph draws from its pen, Godot's `x_off`. */
  xOffset: number;
  advance: number;
  marks: (readonly [number, number])[];
}

function godotClusters(row: ReferenceRun): DrawnCluster[] {
  let pen = 0;
  return clustersOf(row.glyphs).map(({ start, end, glyphs: [base, ...marks] }) => {
    const x = pen;
    pen += base!.advance;
    // Godot offsets a mark from the pen after the base, in y down; the layout offsets it from the base's origin.
    const markOffsets = marks.map(({ offset: [mx, my] }) => [base!.advance + mx, my] as const);
    return {
      start,
      end,
      glyph: base!.index,
      x,
      xOffset: base!.offset[0],
      advance: base!.advance,
      marks: markOffsets,
    };
  });
}

function layoutClusters(
  placements: readonly GlyphPlacement[],
  glyphOf: (ch: string) => number
): DrawnCluster[] {
  return placements
    .filter(({ char }) => char !== '\u200b')
    .map((placed) => ({
      start: placed.sourceIndex!,
      end: placed.sourceIndex! + placed.char.length,
      glyph: placed.glyphIndex ?? glyphOf(placed.decomposition?.base ?? placed.char),
      x: placed.x,
      xOffset: placed.xOffset ?? 0,
      advance: placed.advance,
      // Adding zero turns the layout's -0 into the 0 of the reference.
      marks: (placed.decomposition?.marks ?? []).map(({ x, y }) => [x + 0, y + 0] as const),
    }));
}

const rows = reference as unknown as ReferenceRun[];
const title = (row: ReferenceRun): string =>
  `${JSON.stringify(row.text)} at ${row.sizePx} px in ${row.font} at ${JSON.stringify(row.opentype)}`;

describe('shapeText — the glyph runs of a font against Godot', () => {
  it.each(rows.map((row) => [title(row), row] as const))('shapes %s', async (_, row) => {
    const glyphIndexOf = sfntGlyphIndex(await sfntOf(row.font))!;
    const placements = placementsOf(row.text, row.sizePx, await faceAt(row));

    expect(layoutClusters(placements, (ch) => glyphIndexOf(ch.codePointAt(0)!))).toEqual(godotClusters(row));
  });
});

describe('shapeText — the ligatures of the default theme font against Godot', () => {
  const bundledRows = rows.filter(({ font }) => font === BUNDLED_FONT);

  it.each(bundledRows.map((row) => [title(row), row] as const))(
    'shapes %s on the atlas face',
    async (_, row) => {
      const glyphIndexOf = sfntGlyphIndex(await sfntOf(row.font))!;
      const placements = placementsOf(row.text, row.sizePx, OPEN_SANS_FONT_METRICS);

      expect(layoutClusters(placements, (ch) => glyphIndexOf(ch.codePointAt(0)!))).toEqual(
        godotClusters(row)
      );
    }
  );
});
