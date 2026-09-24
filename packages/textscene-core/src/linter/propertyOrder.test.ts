import { describe, it, expect } from 'vitest';
import { targetsBeforeLatestTrigger } from './propertyOrder';

/** Build a raw property bag with keys in the given order (values are irrelevant here). */
function bag(...keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, '0']));
}

describe('targetsBeforeLatestTrigger', () => {
  it('is empty when no trigger is present at all', () => {
    expect(targetsBeforeLatestTrigger(bag('offset_left'), ['offset_left'], ['anchors_preset'])).toEqual([]);
  });

  it('flags a target authored before the single present trigger', () => {
    expect(
      targetsBeforeLatestTrigger(bag('offset_left', 'anchors_preset'), ['offset_left'], ['anchors_preset'])
    ).toEqual(['offset_left']);
  });

  it('is clean when the target is authored after the single trigger', () => {
    expect(
      targetsBeforeLatestTrigger(bag('anchors_preset', 'offset_left'), ['offset_left'], ['anchors_preset'])
    ).toEqual([]);
  });

  it('flags a target sandwiched between two triggers — one still ran after it', () => {
    // Range::set_max (range.cpp:228-241) re-clamps `value` after `min_value`
    // has already applied, so a target between two triggers is still at risk.
    expect(
      targetsBeforeLatestTrigger(
        bag('min_value', 'value', 'max_value'),
        ['value'],
        ['min_value', 'max_value']
      )
    ).toEqual(['value']);
  });

  it('is clean only once the target is after EVERY present trigger', () => {
    expect(
      targetsBeforeLatestTrigger(
        bag('min_value', 'max_value', 'value'),
        ['value'],
        ['min_value', 'max_value']
      )
    ).toEqual([]);
  });

  it('only considers triggers that are actually present', () => {
    // `page` is a trigger but absent here, so it must not flag `value`
    // against a key that never fires.
    expect(
      targetsBeforeLatestTrigger(bag('value', 'min_value'), ['value'], ['min_value', 'max_value', 'page'])
    ).toEqual(['value']);
    expect(
      targetsBeforeLatestTrigger(bag('min_value', 'value'), ['value'], ['min_value', 'max_value', 'page'])
    ).toEqual([]);
  });

  it('reports every flagged target, preserving the caller-given target order', () => {
    expect(
      targetsBeforeLatestTrigger(
        bag('offset_left', 'grow_horizontal', 'anchors_preset', 'offset_top'),
        ['offset_left', 'offset_top', 'grow_horizontal'],
        ['anchors_preset']
      )
    ).toEqual(['offset_left', 'grow_horizontal']);
  });

  it('ignores a target key that is not authored at all', () => {
    expect(
      targetsBeforeLatestTrigger(bag('anchors_preset'), ['offset_left'], ['anchors_preset'])
    ).toEqual([]);
  });
});
