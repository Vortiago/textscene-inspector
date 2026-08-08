/**
 * Tests for ItemList's semantic linter rule. Strict-parser format checks live
 * in linterParser.test.ts and are asserted through `validatorRegistry` there.
 *
 * Uses `Linter` via testkit, not the `linter/index.ts` barrel: that barrel
 * side-effect-imports every in-flight slice, so pulling it here would fail
 * flakily on a sibling's half-written file mid-wave.
 */

import { describe, expect, it } from 'vitest';
import {
  node,
  scene,
  lint,
  expectDiagnostic,
  expectNoDiagnostic,
} from '../../../../linter/testing/testkit';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import './linterParser';
import './linter';

describe('ItemList semantic rules', () => {
  it('warns when an item_<N>/… index is >= item_count', () => {
    expectDiagnostic(
      scene(
        node('ItemList', {
          item_count: 2,
          'item_0/text': '"Sword"',
          'item_2/text': '"Potion"',
        })
      ),
      {
        ruleName: 'itemlist-item-index-out-of-range',
        severity: 'error',
        nodeType: 'ItemList',
        contains: ['2', 'item_count (2)'],
      }
    );
  });

  it('warns when item_count is absent, because the array then has length 0', () => {
    // `item_count` defaults to 0 (doc/classes/ItemList.xml), and the serialiser
    // omits a property sitting at its default, so an absent count is a real
    // empty list rather than an unknown one.
    expectDiagnostic(
      scene(
        node('ItemList', {
          'item_0/text': '"Sword"',
        })
      ),
      {
        ruleName: 'itemlist-item-index-out-of-range',
        severity: 'error',
        nodeType: 'ItemList',
      }
    );
  });

  it('leaves a negative index to the per-property validator', () => {
    // The dispatcher in linterParser.ts already errors on a negative index, so
    // reporting it here too would double the diagnostic for one mistake.
    expectNoDiagnostic(
      scene(
        node('ItemList', {
          item_count: 2,
          'item_-1/text': '"Sword"',
        })
      ),
      { ruleName: 'itemlist-item-index-out-of-range' }
    );
  });

  it('does not warn when every item index is within item_count', () => {
    expectNoDiagnostic(
      scene(
        node('ItemList', {
          item_count: 3,
          'item_0/text': '"Sword"',
          'item_1/selectable': false,
          'item_2/disabled': true,
        })
      ),
      { ruleName: 'itemlist-item-index-out-of-range' }
    );
  });

  it('stays quiet when item_count itself is malformed', () => {
    // Its own validator already reports the format; this rule only reasons
    // about a count that parsed.
    expectNoDiagnostic(
      scene(
        node('ItemList', {
          item_count: '"three"',
          'item_9/text': '"Potion"',
        })
      ),
      { ruleName: 'itemlist-item-index-out-of-range' }
    );
  });

  it('draws nothing from the committed fixture', () => {
    // linterParser.test.ts makes the same claim for the strict parser's
    // validators; this is the rule half of the fixture's "zero errors and zero
    // warnings" promise, and it is the half `expectFixtureClean` cannot see.
    expect(lint(readFixture('unit-item-list.tscn'))).toEqual([]);
  });

  it('reports each offending index once, however many leaves it carries', () => {
    const diagnostic = expectDiagnostic(
      scene(
        node('ItemList', {
          item_count: 1,
          'item_4/text': '"Potion"',
          'item_4/disabled': true,
          'item_7/text': '"Elixir"',
        })
      ),
      { ruleName: 'itemlist-item-index-out-of-range', severity: 'error' }
    );
    // One diagnostic listing both indices, not one per key.
    if (!diagnostic.message.includes('4, 7')) {
      throw new Error(`expected the indices listed once and in order, got: ${diagnostic.message}`);
    }
  });
});
