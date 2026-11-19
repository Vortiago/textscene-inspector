import { describe, expect, it } from 'vitest';
import { switchFailures } from './switchFailures.mjs';

const SWITCHED = { ink: 25_000, canvases: 1, isReplacedContextLost: true };

const PASSING = {
  inGameInk: 9000,
  hiddenCapture: 1400,
  modes: { '3D': SWITCHED, '2D': { ...SWITCHED, ink: 18_000 }, 'in-game': SWITCHED },
  hiddenWrite: { before: 25_000, hidden: 23_000, shown: 23_000 },
  changedFromFreshMount: { '3D': 0, '2D': 0, 'in-game': 0 },
  changedFromFirstInGame: 3000,
  capturedVsShown: {
    '3D': { changedPixels: 0, maxChannelDelta: 0 },
    '2D': { changedPixels: 0, maxChannelDelta: 0 },
    'in-game': { changedPixels: 0, maxChannelDelta: 0 },
  },
};

const failuresOf = (results) => switchFailures({ results: { ...PASSING, ...results }, errors: [] });

describe('switchFailures', () => {
  it('passes a view that drew every mode, and settled a write while hidden', () => {
    expect(failuresOf({})).toEqual([]);
  });

  it('fails a hidden view that settled without drawing the write', () => {
    expect(failuresOf({ hiddenWrite: { before: 25_000, hidden: 25_000, shown: 25_000 } })).toEqual([
      'update: a write while hidden: expected at most 24000 drawn pixels once it settles, got 25000',
    ]);
  });

  it('fails a view that drew something new once shown', () => {
    expect(failuresOf({ hiddenWrite: { before: 25_000, hidden: 23_000, shown: 21_000 } })).toEqual([
      'update: a write while hidden: expected the shown view to keep its 23000 drawn pixels, got 21000',
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

  it('fails a capture whose pixels differ from what the view shows', () => {
    const capturedVsShown = {
      ...PASSING.capturedVsShown,
      '2D': { changedPixels: 76_800, maxChannelDelta: 255 },
    };
    expect(failuresOf({ capturedVsShown })).toEqual([
      'update: captureImage in 2D: expected the pixels the view shows, got 76800 changed pixels, at most 255/255',
    ]);
  });

  it('fails a capture of another size than the view', () => {
    const sizeMismatch = { expected: { width: 320, height: 240 }, actual: { width: 1152, height: 648 } };
    const capturedVsShown = { ...PASSING.capturedVsShown, 'in-game': sizeMismatch };
    expect(failuresOf({ capturedVsShown })).toEqual([
      'update: captureImage in in-game: expected the pixels the view shows, got a 1152 x 648 PNG for a 320 x 240 view',
    ]);
  });
});
