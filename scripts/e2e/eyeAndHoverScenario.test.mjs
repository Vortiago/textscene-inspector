import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { CLEAN_LOAD, fakeGate } from './gate.testkit.mjs';
import { checkEyeAndHover, outlinePixels } from './eyeAndHoverScenario.mjs';

const TWO_BOXES = { left: { x: 10, y: 5 }, right: { x: 30, y: 5 } };
const RIGHT_BOX = { left: { x: 28, y: 5 }, right: { x: 32, y: 5 } };
const HOVER = { before: 0, hovered: 120, left: 0, selectedWhileHovered: [] };
const EYE = { labelBefore: 'Hide node', labelAfter: 'Show node', boxesAfter: RIGHT_BOX };

function failuresOf(run) {
  const gate = fakeGate();
  checkEyeAndHover(gate, { boxesBefore: TWO_BOXES, hover: HOVER, eye: EYE, diagnostics: CLEAN_LOAD, ...run });
  return gate.failures;
}

describe('outlinePixels', () => {
  it('counts the pure green pixels only', () => {
    const png = new PNG({ width: 3, height: 1 });
    png.data.set([0, 255, 0, 255, 255, 0, 0, 255, 0, 255, 255, 255]);
    expect(outlinePixels(PNG.sync.write(png))).toBe(1);
  });
});

describe('checkEyeAndHover', () => {
  it('passes a run where hover outlines and the eye hides the left box', () => {
    expect(failuresOf({})).toEqual([]);
  });

  it('fails a hovered row that draws no outline', () => {
    expect(failuresOf({ hover: { ...HOVER, hovered: 0 } })).toHaveLength(1);
  });

  it('fails a hovered row that selects', () => {
    expect(failuresOf({ hover: { ...HOVER, selectedWhileHovered: ['Root/Open'] } })).toHaveLength(1);
  });

  it('fails an eye that leaves the left box drawn', () => {
    expect(failuresOf({ eye: { ...EYE, boxesAfter: TWO_BOXES } })).toHaveLength(1);
  });

  it('fails an eye whose label does not flip', () => {
    expect(failuresOf({ eye: { ...EYE, labelAfter: 'Hide node' } })).toHaveLength(1);
  });
});
