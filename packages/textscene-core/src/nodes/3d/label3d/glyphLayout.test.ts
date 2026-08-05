import { describe, expect, it } from 'vitest';
import { AutowrapMode, shapeText } from '../../../r3f/controls/native/text/textLayout';
import { getLinePitchPx } from '../../../r3f/controls/native/text/openSansMetrics';
import { originCorrectionPx } from '../../../r3f/controls/native/text/textOrigin';
import { OPEN_SANS_ATLAS_INFO } from '../../../r3f/controls/native/text/openSansAtlas';
import { layoutLabel3DLines, outlineDistanceBias, MAX_DISTANCE_BIAS } from './glyphLayout';
import { HorizontalAlignment } from './types';

const FONT_SIZE = 32;

function shape(text: string, lineSpacingPx = 0) {
  return shapeText(text, { fontSizePx: FONT_SIZE, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx });
}

describe('layoutLabel3DLines', () => {
  it('centres a single line vertically on the origin (label_3d.cpp VERTICAL_ALIGNMENT_CENTER default)', () => {
    const layout = shape('Hi');
    const [placement] = layoutLabel3DLines(layout, HorizontalAlignment.CENTER, 0, FONT_SIZE);
    const contentHeightPx = layout.heightPx; // line_spacing 0
    const expectedY = -contentHeightPx / 2 + originCorrectionPx(FONT_SIZE);
    expect(placement!.y).toBeCloseTo(expectedY, 6);
  });

  it('each subsequent line advances by exactly one linePitchPx', () => {
    const layout = shape('A\nB\nC');
    const placements = layoutLabel3DLines(layout, HorizontalAlignment.CENTER, 0, FONT_SIZE);
    expect(placements.length).toBe(3);
    expect(placements[1]!.y - placements[0]!.y).toBeCloseTo(layout.linePitchPx, 6);
    expect(placements[2]!.y - placements[1]!.y).toBeCloseTo(layout.linePitchPx, 6);
  });

  it('LEFT starts every line at x=0 regardless of its own width', () => {
    const layout = shape('A\nBB');
    const placements = layoutLabel3DLines(layout, HorizontalAlignment.LEFT, 0, FONT_SIZE);
    expect(placements[0]!.x).toBe(0);
    expect(placements[1]!.x).toBe(0);
  });

  it('CENTER centres each line independently by its own width', () => {
    const layout = shape('A\nBB');
    const placements = layoutLabel3DLines(layout, HorizontalAlignment.CENTER, 0, FONT_SIZE);
    expect(placements[0]!.x).toBeCloseTo(-layout.lines[0]!.widthPx / 2, 6);
    expect(placements[1]!.x).toBeCloseTo(-layout.lines[1]!.widthPx / 2, 6);
  });

  it('RIGHT ends every line at x=0 (offset = -lineWidth)', () => {
    const layout = shape('A\nBB');
    const placements = layoutLabel3DLines(layout, HorizontalAlignment.RIGHT, 0, FONT_SIZE);
    expect(placements[0]!.x).toBeCloseTo(-layout.lines[0]!.widthPx, 6);
    expect(placements[1]!.x).toBeCloseTo(-layout.lines[1]!.widthPx, 6);
  });

  it('FILL folds into CENTER (label_3d.cpp:592 falls FILL through to the CENTER case; no per-line justification)', () => {
    const layout = shape('BB');
    const center = layoutLabel3DLines(layout, HorizontalAlignment.CENTER, 0, FONT_SIZE);
    const fill = layoutLabel3DLines(layout, HorizontalAlignment.FILL, 0, FONT_SIZE);
    expect(fill[0]!.x).toBeCloseTo(center[0]!.x, 6);
  });

  it('line_spacing widens the per-line pitch and the vertical-centring subtraction', () => {
    const withSpacing = shape('A\nB', 5);
    const placements = layoutLabel3DLines(withSpacing, HorizontalAlignment.CENTER, 5, FONT_SIZE);
    expect(placements[1]!.y - placements[0]!.y).toBeCloseTo(getLinePitchPx(FONT_SIZE, 5), 6);
  });

  it('an empty layout (no lines) returns an empty placement list', () => {
    // shapeText always yields at least one (possibly empty) line for '', so
    // exercise the function directly against a synthesized empty result.
    const placements = layoutLabel3DLines(
      { lines: [], linePitchPx: getLinePitchPx(FONT_SIZE), widthPx: 0, heightPx: 0 },
      HorizontalAlignment.CENTER,
      0,
      FONT_SIZE
    );
    expect(placements).toEqual([]);
  });
});

describe('outlineDistanceBias', () => {
  it('is 0 when outline_size is 0 (Godot skips the outline pass entirely)', () => {
    expect(outlineDistanceBias(0, FONT_SIZE)).toBe(0);
  });

  it('is 0 for a negative outline_size (defensive; the parser never emits one)', () => {
    expect(outlineDistanceBias(-1, FONT_SIZE)).toBe(0);
  });

  it('is 0 when fontSizePx is 0 (defensive; avoids a divide-by-zero)', () => {
    expect(outlineDistanceBias(8, 0)).toBe(0);
  });

  it('grows with outline_size, until the atlas headroom clamp', () => {
    const small = outlineDistanceBias(1, FONT_SIZE);
    const larger = outlineDistanceBias(2, FONT_SIZE);
    expect(larger).toBeGreaterThan(small);
    expect(larger).toBeLessThanOrEqual(MAX_DISTANCE_BIAS);
  });

  it('clamps at MAX_DISTANCE_BIAS for a large outline_size', () => {
    expect(outlineDistanceBias(200, FONT_SIZE)).toBe(MAX_DISTANCE_BIAS);
  });

  it('requests a LARGER bias at a SMALLER font_size for the same outline_size (outline_size is an absolute px quantity, independent of font_size)', () => {
    // outline_size 1 (not 4): large enough to be unambiguously positive, small
    // enough that neither font_size clamps at MAX_DISTANCE_BIAS, or this
    // comparison would trivially see two equal, clamped values.
    const at32 = outlineDistanceBias(1, 32);
    const at16 = outlineDistanceBias(1, 16);
    expect(at16).toBeGreaterThan(at32);
    expect(at16).toBeLessThan(MAX_DISTANCE_BIAS);
  });

  it('never exceeds the atlas distanceRange-normalized upper bound of 1.0', () => {
    expect(MAX_DISTANCE_BIAS).toBeLessThan(1);
    expect(OPEN_SANS_ATLAS_INFO.distanceRange).toBeGreaterThan(0);
  });
});
