import { describe, expect, it } from 'vitest';
import { CLEAN_LOAD, fakeGate } from './gate.testkit.mjs';
import { checkInGameStretch, stretchProbes } from './inGameStretchScenario.mjs';

const BLACK = [0, 0, 0];
const SCENE = [62, 97, 166];

function failuresOf(pixels) {
  const gate = fakeGate();
  checkInGameStretch(gate, { pixels, diagnostics: CLEAN_LOAD });
  return gate.failures;
}

describe('stretchProbes', () => {
  it('reads the centre column, the bars 0.4 of the window off the centre', () => {
    expect(stretchProbes({ width: 1000, height: 600 })).toEqual({
      top: { x: 500, y: 60 },
      scene: { x: 500, y: 360 },
      bottom: { x: 500, y: 540 },
    });
  });
});

describe('checkInGameStretch', () => {
  it('passes black bars around the scene', () => {
    expect(failuresOf({ top: BLACK, scene: SCENE, bottom: BLACK })).toEqual([]);
  });

  it('fails a window drawn with no bars', () => {
    expect(failuresOf({ top: SCENE, scene: SCENE, bottom: SCENE })).toHaveLength(1);
  });

  it('fails bars that show the page through them', () => {
    expect(failuresOf({ top: [24, 24, 24], scene: SCENE, bottom: [24, 24, 24] })).toHaveLength(1);
  });

  it('fails a canvas that never settled', () => {
    expect(failuresOf(null)).toEqual([expect.stringContaining('never settled')]);
  });
});
