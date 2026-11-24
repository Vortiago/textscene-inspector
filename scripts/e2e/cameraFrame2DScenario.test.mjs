import { describe, expect, it } from 'vitest';
import { CLEAN_LOAD, fakeGate } from './gate.testkit.mjs';
import { checkCameraFrame2D, FRAMED_SQUARE_PX } from './cameraFrame2DScenario.mjs';

const CANVAS = { width: 800, height: 600 };

/** A shot whose square, `size` px across, has its centre at (x, y). */
const shotWithSquareAt = (x, y, size) => ({
  ...CANVAS,
  box: { left: x - size / 2, top: y - size / 2, width: size, height: size },
});

const passingRun = () => ({
  opened: shotWithSquareAt(700, 500, 40),
  framed: shotWithSquareAt(400, 300, FRAMED_SQUARE_PX),
  diagnostics: CLEAN_LOAD,
});

const failuresOf = (run) => {
  const gate = fakeGate();
  checkCameraFrame2D(gate, run);
  return gate.failures;
};

describe('checkCameraFrame2D', () => {
  it('passes a frame that centres the square at the camera zoom', () => {
    expect(failuresOf(passingRun())).toEqual([]);
  });

  it('fails a frame that leaves the square off the centre', () => {
    const run = { ...passingRun(), framed: shotWithSquareAt(420, 300, FRAMED_SQUARE_PX) };
    expect(failuresOf(run)).toHaveLength(1);
    expect(failuresOf(run)[0]).toContain('20 px off the centre');
  });

  it('fails a frame at the wrong zoom', () => {
    const run = { ...passingRun(), framed: shotWithSquareAt(400, 300, 100) };
    expect(failuresOf(run)[0]).toContain('100 px across, expected 200');
  });

  it('fails a run whose fit on open already centres the square', () => {
    const run = { ...passingRun(), opened: shotWithSquareAt(400, 300, 40) };
    expect(failuresOf(run)[0]).toContain('already centres the square');
  });

  it('fails a frame that draws no square', () => {
    const run = { ...passingRun(), framed: { ...CANVAS, box: null } };
    expect(failuresOf(run)).toHaveLength(2);
  });
});
