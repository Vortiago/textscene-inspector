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
import { openFontContainer } from './fontContainer';
import { opentypeOf } from './glyphVariation.testkit';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import { sfntGlyphIndex, sfntHasGlyph } from './sfntCmap';
import { sfntFaceGlyphs } from './sfntFaceGlyphs';
import { glyphMetricsReader } from './sfntGlyphMetrics';
import { openFontOutlines } from './sfntOutlines';
import { bundledFontBytes } from './bundledFontBytes';
import { fixtureFontBytes } from './sfntOutlines.testkit';
import { OUTLINE_TABLE_TAGS, parseSfntScalars, type SfntFile } from './sfntTables';
import type { GlyphPlacement } from './textLayout';
import { glyphsOf } from './textLayout.testkit';
import { defaultKerningReader } from './variation/instanceKerning';

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
  font === BUNDLED_FONT ? bundledFontBytes() : fixtureFontBytes(font);

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
  const kerningOf = defaultKerningReader(sfnt);
  const lookupGlyph = (ch: string) => {
    const codePoint = ch.codePointAt(0)!;
    return { glyph: glyphIndexOf(codePoint), codePoint };
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
    ...sfntFaceGlyphs(sfnt, () => sfnt, defaultKerningReader),
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

/** What Godot draws for one cluster, in the shape the layout gives it: a glyph, its pen and each mark's offset. */
interface DrawnCluster {
  start: number;
  end: number;
  glyph: number;
  x: number;
  /** How far the glyph draws from its pen, Godot's `x_off`. */
  xOffset: number;
  advance: number;
  /** Where each later glyph of the cluster draws, from the first glyph's origin. */
  marks: (readonly [number, number])[];
}

function godotClusters(row: ReferenceRun): DrawnCluster[] {
  let pen = 0;
  return clustersOf(row.glyphs).map(({ start, end, glyphs: [base, ...rest] }) => {
    const x = pen;
    pen += base!.advance;
    // Godot offsets a glyph from its pen, in y down; the layout gives each glyph after the first its
    // own pen, so both read from the first glyph's origin.
    const followers = rest.map(({ advance, offset: [ox, oy] }) => {
      const follower = [pen - x + ox, oy] as const;
      pen += advance;
      return follower;
    });
    return {
      start,
      end,
      glyph: base!.index,
      x,
      xOffset: base!.offset[0],
      advance: base!.advance,
      marks: followers,
    };
  });
}

function layoutClusters(
  placements: readonly GlyphPlacement[],
  glyphOf: (ch: string) => number
): DrawnCluster[] {
  const drawn = placements.filter(({ char }) => char !== '\u200b');
  return clusterGroups(drawn).map(([base, ...marks]) => ({
    start: base!.sourceIndex!,
    end: base!.sourceIndex! + (base!.cluster ?? base!.char).length,
    glyph: base!.glyphIndex ?? glyphOf(base!.char),
    x: base!.x,
    xOffset: base!.xOffset ?? 0,
    advance: base!.advance,
    // Adding zero turns the layout's -0 into the 0 of the reference.
    marks: marks.map(
      (mark) => [mark.x - base!.x + (mark.xOffset ?? 0) + 0, (mark.yOffset ?? 0) + 0] as const
    ),
  }));
}

/** The placements of each cluster: a base, then the marks that share its cluster and source index. */
function clusterGroups(placements: readonly GlyphPlacement[]): GlyphPlacement[][] {
  const groups: GlyphPlacement[][] = [];
  placements.forEach((placed, i) => {
    const before = placements[i - 1];
    const continuesCluster = placed.cluster !== undefined && before?.sourceIndex === placed.sourceIndex;
    if (continuesCluster) groups.at(-1)!.push(placed);
    else groups.push([placed]);
  });
  return groups;
}

const rows = reference as unknown as ReferenceRun[];
const title = (row: ReferenceRun): string =>
  `${JSON.stringify(row.text)} at ${row.sizePx} px in ${row.font} at ${JSON.stringify(row.opentype)}`;

describe('shapeText — the glyph runs of a font against Godot', () => {
  it.each(rows.map((row) => [title(row), row] as const))('shapes %s', async (_, row) => {
    const glyphIndexOf = sfntGlyphIndex(await sfntOf(row.font))!;
    const placements = glyphsOf(row.text, await faceAt(row), row.sizePx);

    expect(layoutClusters(placements, (ch) => glyphIndexOf(ch.codePointAt(0)!))).toEqual(godotClusters(row));
  });
});

describe('shapeText — the ligatures of the default theme font against Godot', () => {
  const bundledRows = rows.filter(({ font }) => font === BUNDLED_FONT);

  it.each(bundledRows.map((row) => [title(row), row] as const))(
    'shapes %s on the atlas face',
    async (_, row) => {
      const glyphIndexOf = sfntGlyphIndex(await sfntOf(row.font))!;
      const placements = glyphsOf(row.text, OPEN_SANS_FONT_METRICS, row.sizePx);

      expect(layoutClusters(placements, (ch) => glyphIndexOf(ch.codePointAt(0)!))).toEqual(
        godotClusters(row)
      );
    }
  );
});
