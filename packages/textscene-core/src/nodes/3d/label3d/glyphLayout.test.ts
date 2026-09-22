import { describe, expect, it } from 'vitest';
import { AutowrapMode, shapeText } from '../../../r3f/controls/native/text/textLayout';
import { getLinePitchPx } from '../../../r3f/controls/native/text/openSansMetrics';
import { OPEN_SANS_ATLAS_GLYPHS, OPEN_SANS_ATLAS_INFO } from '../../../r3f/controls/native/text/openSansAtlas';
import { OPEN_SANS_FONT_METRICS } from '../../../r3f/controls/native/text/openSansFontMetrics';
import { buildGlyphQuadArrays } from '../../../r3f/controls/native/text/TextRun';
import { layoutLabel3DLines, outlineRadiusPx, outlineStrokeWidthPx } from './glyphLayout';
import { soloLineLayout } from '../../../r3f/controls/native/text/textLayout';
import { HorizontalAlignment } from './types';

const FONT_SIZE = 32;

function shape(text: string, lineSpacingPx = 0) {
  return shapeText(text, { fontSizePx: FONT_SIZE, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx });
}

describe('layoutLabel3DLines', () => {
  it('centres a single line vertically on the origin (label_3d.cpp VERTICAL_ALIGNMENT_CENTER default)', () => {
    const layout = shape('Hi');
    const [placement] = layoutLabel3DLines(layout, HorizontalAlignment.CENTER, 0);
    const contentHeightPx = layout.heightPx; // line_spacing 0
    expect(placement!.y).toBeCloseTo(-contentHeightPx / 2, 6);
  });

  it('each subsequent line advances by exactly one linePitchPx', () => {
    const layout = shape('A\nB\nC');
    const placements = layoutLabel3DLines(layout, HorizontalAlignment.CENTER, 0);
    expect(placements.length).toBe(3);
    expect(placements[1]!.y - placements[0]!.y).toBeCloseTo(layout.linePitchPx, 6);
    expect(placements[2]!.y - placements[1]!.y).toBeCloseTo(layout.linePitchPx, 6);
  });

  it('LEFT starts every line at x=0 regardless of its own width', () => {
    const layout = shape('A\nBB');
    const placements = layoutLabel3DLines(layout, HorizontalAlignment.LEFT, 0);
    expect(placements[0]!.x).toBe(0);
    expect(placements[1]!.x).toBe(0);
  });

  it('CENTER centres each line independently by its own width', () => {
    const layout = shape('A\nBB');
    const placements = layoutLabel3DLines(layout, HorizontalAlignment.CENTER, 0);
    expect(placements[0]!.x).toBeCloseTo(-layout.lines[0]!.widthPx / 2, 6);
    expect(placements[1]!.x).toBeCloseTo(-layout.lines[1]!.widthPx / 2, 6);
  });

  it('RIGHT ends every line at x=0 (offset = -lineWidth)', () => {
    const layout = shape('A\nBB');
    const placements = layoutLabel3DLines(layout, HorizontalAlignment.RIGHT, 0);
    expect(placements[0]!.x).toBeCloseTo(-layout.lines[0]!.widthPx, 6);
    expect(placements[1]!.x).toBeCloseTo(-layout.lines[1]!.widthPx, 6);
  });

  it('FILL folds into CENTER (label_3d.cpp:592 falls FILL through to the CENTER case; no per-line justification)', () => {
    const layout = shape('BB');
    const center = layoutLabel3DLines(layout, HorizontalAlignment.CENTER, 0);
    const fill = layoutLabel3DLines(layout, HorizontalAlignment.FILL, 0);
    expect(fill[0]!.x).toBeCloseTo(center[0]!.x, 6);
  });

  it('line_spacing widens the per-line pitch and the vertical-centring subtraction', () => {
    const withSpacing = shape('A\nB', 5);
    const placements = layoutLabel3DLines(withSpacing, HorizontalAlignment.CENTER, 5);
    expect(placements[1]!.y - placements[0]!.y).toBeCloseTo(getLinePitchPx(FONT_SIZE, 5), 6);
  });

  it('an empty layout (no lines) returns an empty placement list', () => {
    // shapeText always yields at least one (possibly empty) line for '', so
    // exercise the function directly against a synthesized empty result.
    const placements = layoutLabel3DLines(
      {
        lines: [],
        linePitchPx: getLinePitchPx(FONT_SIZE),
        widthPx: 0,
        heightPx: 0,
        baselineOffsetPx: 35,
        fontMetrics: OPEN_SANS_FONT_METRICS,
      },
      HorizontalAlignment.CENTER,
      0
    );
    expect(placements).toEqual([]);
  });
});

/**
 * Label3D is the ONE text painter with no golden image behind it
 * (`scripts/visual/scenes.mjs` excludes its fixture — it renders blank in
 * that harness), so the composed number this describe pins is the only thing
 * standing in for one: where a glyph's ink actually lands is
 * `layoutLabel3DLines`'s own placement Y PLUS the quad top
 * `buildGlyphQuadArrays` produces for the same line, and only the SUM is
 * observable. Either half may move as long as the sum does not; asserting
 * either half alone would let a change to one silently cancel against the
 * other, or worse, not cancel at all.
 *
 * Hand-derived at `font_size` 32, `line_spacing` 0, one line ('Hi'):
 *   ascentPx  = ceil(2189*32/2048) = ceil(34.203125) = 35
 *   descentPx = ceil(600*32/2048)  = ceil(9.375)     = 10
 *   linePitchPx = 45 -> heightPx = 45, contentHeightPx = 45
 *   placement.y = -45/2 = -22.5, so the wrapping group sits at three-local
 *     y = +22.5 (`rect.ts`'s negate-once convention)
 *   'H' bake metrics (`openSansAtlas.ts`): yoffset 13, bake `base` 45, bake
 *     `fontSize` 42 -> scale 32/42
 *   quad top, Godot px below the line's box top
 *     = baselineOffsetPx - base*scale + yoffset*scale
 *     = 35 - 45*(32/42) + 13*(32/42) = 35 - 32*(32/42) = 10.61904761...
 *   composed three-local Y = 22.5 - 10.61904761... = 11.88095238...
 */
describe('layoutLabel3DLines + buildGlyphQuadArrays (the composed ink position — Label3D has no golden)', () => {
  function composedTopY(text: string, lineSpacingPx: number, lineIndex: number): number {
    const layout = shape(text, lineSpacingPx);
    const placement = layoutLabel3DLines(layout, HorizontalAlignment.CENTER, lineSpacingPx)[lineIndex]!;
    const quads = buildGlyphQuadArrays(soloLineLayout(placement.line, layout), FONT_SIZE);
    // Vertex order per quad is TL, TR, BL, BR; TL's y is float index 1.
    return -placement.y + quads.positions[1]!;
  }

  it("a single line's first glyph lands at three-local y = 11.880952... (the worked example above)", () => {
    const contentHeightPx = 45;
    const scale = FONT_SIZE / OPEN_SANS_ATLAS_INFO.fontSize;
    const quadTopBelowBoxTop = 35 - (OPEN_SANS_ATLAS_INFO.base - OPEN_SANS_ATLAS_GLYPHS.H!.yoffset) * scale;
    expect(composedTopY('Hi', 0, 0)).toBeCloseTo(contentHeightPx / 2 - quadTopBelowBoxTop, 5);
    expect(composedTopY('Hi', 0, 0)).toBeCloseTo(11.88095238, 5);
  });

  it('a three-line block steps by exactly one linePitchPx per line, composed', () => {
    expect(composedTopY('A\nB\nC', 0, 0)).toBeCloseTo(56.88095238, 5);
    expect(composedTopY('A\nB\nC', 0, 1)).toBeCloseTo(11.88095238, 5);
    expect(composedTopY('A\nB\nC', 0, 2)).toBeCloseTo(-33.11904762, 5);
  });

  it('line_spacing widens the composed step by exactly the spacing', () => {
    expect(composedTopY('A\nB', 5, 0)).toBeCloseTo(36.88095238, 5);
    expect(composedTopY('A\nB', 5, 1)).toBeCloseTo(-13.11904762, 5);
  });
});

describe('the outline stroke (FreeType stroker, text_server_adv.cpp:1383)', () => {
  // `FT_Stroker_Set(stroker, (int)(fd->size.y * 16.0), ...)` takes a 26.6
  // fixed-point radius and `fd->size.y` is the RAW `outline_size`
  // (`text_server_adv.h:406-414` puts `p_size.y` in unscaled), so
  // `outline_size` 12 is 12 * 16 = 192 in 26.6, i.e. 192 / 64 = 3 px of
  // one-sided reach. Godot's own default `outline_size` is 12
  // (`label_3d.h:126`).
  it('gives Label3D\'s default outline_size a 3 px one-sided radius', () => {
    expect(outlineRadiusPx(12)).toBe(3);
  });

  it('scales linearly with outline_size and never with font_size (outline_size is an absolute pixel quantity)', () => {
    expect(outlineRadiusPx(4)).toBe(1);
    expect(outlineRadiusPx(32)).toBe(8);
    // No font_size parameter exists to pass — the C++ keys the stroker off
    // `fd->size.y` alone.
    expect(outlineRadiusPx.length).toBe(1);
  });

  it('truncates to whole 26.6 steps, as the C++ int cast does', () => {
    // 0.5 * 16 = 8 exactly -> 8/64; 0.53 * 16 = 8.48 -> truncated to 8.
    expect(outlineRadiusPx(0.53)).toBe(outlineRadiusPx(0.5));
  });

  it('strokes at twice the radius — a centred canvas stroke reaches half its width outside the contour', () => {
    expect(outlineStrokeWidthPx(12)).toBe(2 * outlineRadiusPx(12));
  });

  it('is 0 when outline_size is 0 (Godot skips the outline pass entirely, label_3d.cpp:610)', () => {
    expect(outlineStrokeWidthPx(0)).toBe(0);
  });

  it('is 0 for a negative outline_size (defensive; the parser never emits one)', () => {
    expect(outlineStrokeWidthPx(-1)).toBe(0);
  });
});
