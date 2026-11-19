import { describe, expect, it } from 'vitest';
import { switchFailures } from './switchFailures.mjs';

const SWITCHED = { ink: 25_000, canvases: 1, isReplacedContextLost: true };

const PASSING = {
  inGameInk: 9000,
  hiddenCapture: 1400,
  modes: { '3D': SWITCHED, '2D': { ...SWITCHED, ink: 18_000 }, 'in-game': SWITCHED },
  hiddenWrite: { before: 25_000, hidden: 25_000, shown: 23_000 },
  changedFromFreshMount: { '3D': 0, '2D': 0, 'in-game': 0 },
  changedFromFirstInGame: 3000,
};

const failuresOf = (results) => switchFailures({ results: { ...PASSING, ...results }, errors: [] });

describe('switchFailures', () => {
  it('passes a view that drew every mode and a write only once shown', () => {
    expect(failuresOf({})).toEqual([]);
  });

  it('fails a hidden view that drew the write', () => {
    expect(failuresOf({ hiddenWrite: { before: 25_000, hidden: 23_000, shown: 23_000 } })).toEqual([
      'update: a write while hidden: expected the hidden view to keep its 25000 drawn pixels, got 23000',
    ]);
  });

  it('fails a view that did not draw the write once shown', () => {
    expect(failuresOf({ hiddenWrite: { before: 25_000, hidden: 25_000, shown: 25_000 } })).toEqual([
      'update: a write while hidden: expected at most 24000 drawn pixels once shown, got 25000',
    ]);
  });

  it('fails a switch that left the replaced canvas live beside the new one', () => {
    const modes = { ...PASSING.modes, '3D': { ...SWITCHED, canvases: 2, isReplacedContextLost: false } };
    expect(failuresOf({ modes })).toEqual([
      'update: 3D: expected one canvas in the element, got 2',
      'update: 3D: expected the replaced canvas to lose its context, got it live',
    ]);
  });

  it('fails a 2D mode that drew only its stage', () => {
    const modes = { ...PASSING.modes, '2D': { ...SWITCHED, ink: 1000 } };
    expect(failuresOf({ modes })).toEqual(['update: 2D: expected at least 5000 drawn pixels, got 1000']);
  });

  it('fails a capture that a hidden view rejected, and names the rejection', () => {
    expect(failuresOf({ hiddenCapture: 'expected a settled view, got no frame drawn' })).toEqual([
      'update: captureImage while hidden: expected a PNG, got expected a settled view, got no frame drawn',
    ]);
  });

  it('fails a switched view whose frame differs from a fresh mount in that mode', () => {
    expect(failuresOf({ changedFromFreshMount: { '3D': 0, '2D': 412, 'in-game': 0 } })).toEqual([
      'update: 2D after a switch: expected the frame of a fresh mount, got 412 changed pixels',
    ]);
  });

  it('fails a switch that dropped a write made before it', () => {
    expect(failuresOf({ changedFromFirstInGame: 0 })).toEqual([
      'update: a write before a switch: expected the In-game frame after the switches to differ from the first, got the same',
    ]);
  });
});
