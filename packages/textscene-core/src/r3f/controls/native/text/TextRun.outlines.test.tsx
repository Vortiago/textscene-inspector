/**
 * `<TextRun>` hands the painter the glyph outlines its font metrics carry, so no Control passes
 * them down. The painter is spied on: the pixels are a golden-image concern.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TextRun } from './TextRun';
import { shapeText } from './textLayout';
import { createRuntimeFontMetrics } from './runtimeFontMetrics';
import { withVariation } from './fontMetrics';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import type { SfntOutlines } from './sfntOutlines';

const painter = vi.hoisted(() => ({ outlinesPainted: [] as unknown[] }));

vi.mock('./canvasTextPainter', async (importOriginal) => {
  const original = await importOriginal<typeof import('./canvasTextPainter')>();
  return {
    ...original,
    paintSceneFontCanvas: (...args: Parameters<typeof original.paintSceneFontCanvas>) => {
      painter.outlinesPainted.push(args[6]);
      return original.paintSceneFontCanvas(...args);
    },
  };
});

const WHITE = { r: 1, g: 1, b: 1, a: 1 };
const OUTLINES: SfntOutlines = { glyphIndex: () => 7, glyphContours: () => null };

const CANVAS_METRICS = createRuntimeFontMetrics({
  scalars: { unitsPerEm: 1000, ascent: 800, descent: 200 },
  measureWidthUnits: (text) => text.length * 500,
  cssFontFamily: 'scene-font-outlines-test',
});

async function paintedOutlines(fontMetrics: typeof CANVAS_METRICS) {
  painter.outlinesPainted = [];
  const layout = shapeText('Hi', {
    fontSizePx: 16,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    fontMetrics,
    lineSpacingPx: 3,
  });
  await ReactThreeTestRenderer.create(<TextRun layout={layout} fontSizePx={16} tint={WHITE} />);
  return painter.outlinesPainted;
}

describe('<TextRun> canvas outlines', () => {
  it('paints with the outlines that the font metrics carry', async () => {
    const bold = withVariation(CANVAS_METRICS, { embolden: 1.2, outlines: OUTLINES });

    expect(await paintedOutlines(bold)).toEqual([OUTLINES]);
  });

  it('paints a face that carries none with no outlines', async () => {
    expect(await paintedOutlines(CANVAS_METRICS)).toEqual([null]);
  });
});
