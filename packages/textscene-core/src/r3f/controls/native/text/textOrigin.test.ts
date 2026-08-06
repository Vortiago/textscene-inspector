/**
 * `originCorrectionPx` reconciles `TextRun`'s atlas-bake line-top against
 * Godot's ascent-based one (`textOrigin.ts`'s own doc). That reconciliation
 * is specific to the baked MSDF atlas path — `canvasTextPainter.ts` already
 * anchors a canvas-kind run at `layout.baselineOffsetPx`, Godot's own
 * convention, so applying the atlas correction on top would double-offset
 * it. `fontMetrics.kind` is the gate.
 */
import { describe, expect, it } from 'vitest';
import { originCorrectionPx } from './textOrigin';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import type { FontMetrics } from './fontMetrics';

/** Any object with `kind: 'canvas'` — `originCorrectionPx` only reads `.kind`. */
const CANVAS_METRICS: Pick<FontMetrics, 'kind'> = { kind: 'canvas' };

describe('originCorrectionPx — gated on FontMetrics.kind', () => {
  it('returns the atlas-bake reconciliation for an atlas-kind FontMetrics at size 16 (base=45, atlas fontSize=42, ascentPx=18: 18 - 45*(16/42) = 0.8571428571428577)', () => {
    expect(originCorrectionPx(16, OPEN_SANS_FONT_METRICS)).toBeCloseTo(0.8571428571428577, 10);
  });

  it('returns 0 for a canvas-kind FontMetrics at the SAME size the atlas case is non-zero for', () => {
    expect(originCorrectionPx(16, CANVAS_METRICS)).toBe(0);
  });

  it('returns 0 for a canvas-kind FontMetrics at a different size too — never derives a non-zero correction off fontSizePx alone', () => {
    expect(originCorrectionPx(32, CANVAS_METRICS)).toBe(0);
  });

  it('the atlas correction is non-zero — a canvas-kind 0 is a real gate, not a coincidence of the atlas math itself being 0', () => {
    expect(originCorrectionPx(16, OPEN_SANS_FONT_METRICS)).not.toBe(0);
  });
});
