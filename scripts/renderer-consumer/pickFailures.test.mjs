import { describe, expect, it } from 'vitest';
import { pickFailures } from './pickFailures.mjs';

const PASSING = {
  unselected: 0,
  onCube: { picks: ['/root/Root/Cube'], outline: 400 },
  onNothing: { picks: [null], outline: 0 },
  hostSelected: 400,
  onNothingHostOwned: { picks: [null], outline: 400 },
  on2D: { picks: [], outline: 0 },
  onInGame: { picks: [], outline: 0 },
};

const failuresOf = (results) => pickFailures({ results: { ...PASSING, ...results }, errors: [] });

describe('pickFailures', () => {
  it('passes a view that picked the cube, nothing, and took no click outside the 3D mode', () => {
    expect(failuresOf({})).toEqual([]);
  });

  it('fails a click on nothing that kept the outline of the view’s own selection', () => {
    expect(failuresOf({ onNothing: { picks: [null], outline: 400 } })).toEqual([
      'pick: a click on nothing: expected under 100 outline pixels, got 400',
    ]);
  });

  it('fails a click on nothing that dropped the host’s selected node', () => {
    expect(failuresOf({ onNothingHostOwned: { picks: [null], outline: 0 } })).toEqual([
      'pick: a click on nothing beside the host’s selected cube: expected at least 100 outline pixels, got 0',
    ]);
  });

  it('fails a click in the 2D mode that the host heard', () => {
    expect(failuresOf({ on2D: { picks: [null], outline: 0 } })).toEqual([
      'pick: a click in the 2D mode: expected onSelect to hear [], got [null]',
    ]);
  });
});
