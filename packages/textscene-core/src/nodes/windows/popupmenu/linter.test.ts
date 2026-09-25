/**
 * PopupMenu's semantic rule. Format checks live in linterParser.test.ts. Uses `Linter`
 * through testkit, not the `linter/index.ts` barrel: the barrel imports every slice,
 * so a sibling's broken file would fail this test.
 */

import { describe, expect, it } from 'vitest';
import {
  node,
  scene,
  lint,
  expectDiagnostic,
  expectNoDiagnostic,
} from '../../../linter/testing/testkit';
import { readFixture } from '../../../linter/testing/fixtureCheck';
import './linterParser';
import './linter';

describe('PopupMenu semantic rules', () => {
  it('errors when an item_<N>/… index is >= item_count', () => {
    // `_get_property` refuses `index >= _call_array_length_getter()`
    // (property_list_helper.cpp:58), and `_set` (popup_menu.cpp:3092) returns
    // that refusal straight out, so `set_item_text` is never called.
    expectDiagnostic(
      scene(
        node('PopupMenu', {
          item_count: 2,
          'item_0/text': '"Open"',
          'item_2/text': '"Autosave"',
        })
      ),
      {
        ruleName: 'popupmenu-item-index-out-of-range',
        severity: 'error',
        nodeType: 'PopupMenu',
        contains: ['2', 'item_count (2)'],
      }
    );
  });

  it('errors when item_count is absent, because the array then has length 0', () => {
    // `item_count` defaults to 0 (doc/classes/PopupMenu.xml), and the
    // serialiser omits a property sitting at its default, so an absent count is
    // a real empty menu rather than an unknown one.
    expectDiagnostic(
      scene(
        node('PopupMenu', {
          'item_0/text': '"Open"',
        })
      ),
      {
        ruleName: 'popupmenu-item-index-out-of-range',
        severity: 'error',
        nodeType: 'PopupMenu',
      }
    );
  });

  it('leaves a negative index to the per-property validator', () => {
    // The dispatcher in linterParser.ts already errors on a negative index, so
    // reporting it here too would double the diagnostic for one mistake.
    expectNoDiagnostic(
      scene(
        node('PopupMenu', {
          item_count: 2,
          'item_-1/text': '"Open"',
        })
      ),
      { ruleName: 'popupmenu-item-index-out-of-range' }
    );
  });

  it('does not error when every item index is within item_count', () => {
    expectNoDiagnostic(
      scene(
        node('PopupMenu', {
          item_count: 3,
          'item_0/text': '"Open"',
          'item_1/checkable': 1,
          'item_2/separator': true,
        })
      ),
      { ruleName: 'popupmenu-item-index-out-of-range' }
    );
  });

  it('stays quiet when item_count itself is malformed', () => {
    // Its own validator already reports the format; this rule only reasons
    // about a count that parsed.
    expectNoDiagnostic(
      scene(
        node('PopupMenu', {
          item_count: '"two"',
          'item_9/text': '"Autosave"',
        })
      ),
      { ruleName: 'popupmenu-item-index-out-of-range' }
    );
  });

  it('draws nothing from the committed fixture', () => {
    expect(lint(readFixture('unit-popup-menu.tscn'))).toEqual([]);
  });

  it('reports each offending index once, however many leaves it carries', () => {
    const diagnostic = expectDiagnostic(
      scene(
        node('PopupMenu', {
          item_count: 1,
          'item_4/text': '"Autosave"',
          'item_4/disabled': true,
          'item_7/text': '"Quit"',
        })
      ),
      { ruleName: 'popupmenu-item-index-out-of-range', severity: 'error' }
    );
    // One diagnostic listing both indices, not one per key.
    if (!diagnostic.message.includes('4, 7')) {
      throw new Error(`expected the indices listed once and in order, got: ${diagnostic.message}`);
    }
  });
});

describe('PopupMenu index spelling in the message', () => {
  it('names an index past 2^53 as the file writes it, not as the double it rounds to', () => {
    const diagnostic = expectDiagnostic(
      scene(node('PopupMenu', { item_count: 2, 'item_9999999999999999999999/text': '"x"' })),
      { ruleName: 'popupmenu-item-index-out-of-range', severity: 'error' }
    );
    expect(diagnostic.message).toContain('index(es) 9999999999999999999999 fall outside item_count (2)');
    expect(diagnostic.message).not.toContain('1e+22');
  });

  it('names a zero-padded index as written, beside the plain spelling of another item', () => {
    const diagnostic = expectDiagnostic(
      scene(node('PopupMenu', { item_count: 1, 'item_004/text': '"a"', 'item_2/text': '"b"' })),
      { ruleName: 'popupmenu-item-index-out-of-range' }
    );
    expect(diagnostic.message).toContain('index(es) 2, 004 fall outside');
  });
});

describe('PopupMenu index grammar', () => {
  it('errors on a `+`-signed index past item_count', () => {
    // `is_valid_int` skips ONE leading sign, `+` as readily as `-`
    // (ustring.cpp:4752), so `item_+2/text` resolves to item 2 and
    // `_get_property` drops it for being past the count
    // (property_list_helper.cpp:58).
    expectDiagnostic(
      scene(node('PopupMenu', { item_count: 1, 'item_+2/text': '"Autosave"' })),
      {
        ruleName: 'popupmenu-item-index-out-of-range',
        severity: 'error',
        nodeType: 'PopupMenu',
        contains: ['2', 'item_count (1)'],
      }
    );
  });
});
