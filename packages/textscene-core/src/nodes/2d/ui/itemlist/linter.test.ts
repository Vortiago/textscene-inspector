/**
 * Tests for ItemList's semantic rule; linterParser.test.ts covers the formats.
 * They use `Linter` through testkit, not the `linter/index.ts` barrel, which
 * imports every slice and so fails on a sibling's half-written file.
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
  it('reports when an item_<N>/… index is >= item_count', () => {
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

  it('reports when item_count is absent, because the array then has length 0', () => {
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

  it('names the count Godot stores when the written one is refused', () => {
    // `set_item_count` opens `ERR_FAIL_COND(p_count < 0)` (item_list.cpp:527),
    // so a negative count is never stored and the array keeps its default 0.
    // Reporting `(-1)` names a value the engine refused, beside the validator
    // that already reported it.
    const diagnostics = lint(
      scene(node('ItemList', { item_count: -1, 'item_0/text': '"Sword"' }))
    ).filter((d) => d.ruleName === 'itemlist-item-index-out-of-range');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.message).toContain('item_count (0)');
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

describe('ItemList index spelling in the message', () => {
  // `int index = ….to_int()` (property_list_helper.cpp:57) keeps the low 32 bits.
  it('applies an index that wraps past 32 bits to the item it lands on', () => {
    const content = scene(node('ItemList', { item_count: 1, 'item_4294967296/text': '"x"' }));
    expect(lint(content).filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('names what Godot stores beside a wrapping index past the count', () => {
    const diagnostic = expectDiagnostic(
      scene(node('ItemList', { item_count: 1, 'item_4294967297/text': '"x"' })),
      { ruleName: 'itemlist-item-index-out-of-range', severity: 'error' }
    );
    expect(diagnostic.message).toContain(
      'index(es) 4294967297 (stored as 1) fall outside item_count (1)'
    );
  });

  // INT64_MIN (ustring.cpp:2284) keeps 0 in its low 32 bits, so the write lands on item 0.
  it('applies an index that saturates to INT64_MIN to item 0', () => {
    const content = scene(
      node('ItemList', { item_count: 1, 'item_-9999999999999999999999/text': '"x"' })
    );
    expect(lint(content).filter((d) => d.severity === 'error')).toEqual([]);
  });

  // INT64_MAX keeps -1, which `_get_property` refuses (property_list_helper.cpp:58).
  it('leaves an index that saturates to INT64_MAX to the negative-index refusal', () => {
    const content = scene(
      node('ItemList', { item_count: 2, 'item_9999999999999999999999/text': '"x"' })
    );
    expectNoDiagnostic(content, { ruleName: 'itemlist-item-index-out-of-range' });
    expectDiagnostic(content, {
      severity: 'error',
      contains: ['Item index 9999999999999999999999 (stored as -1) must be non-negative'],
    });
  });

  it('reports an index the int narrows below zero, naming what it stores', () => {
    expectDiagnostic(scene(node('ItemList', { item_count: 1, 'item_2147483648/text': '"x"' })), {
      severity: 'error',
      contains: ['Item index 2147483648 (stored as -2147483648) must be non-negative'],
    });
  });

  it('names each spelling as written when two resolve to one item', () => {
    const diagnostic = expectDiagnostic(
      scene(node('ItemList', { item_count: 1, 'item_3/text': '"a"', 'item_03/icon': 'null' })),
      { ruleName: 'itemlist-item-index-out-of-range' }
    );
    expect(diagnostic.message).toContain('index(es) 3, 03 fall outside');
  });

  it('caps the list it names, however many items fall outside', () => {
    const items = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [`item_${i + 1}/text`, '"x"'])
    );
    const diagnostic = expectDiagnostic(scene(node('ItemList', { item_count: 1, ...items })), {
      ruleName: 'itemlist-item-index-out-of-range',
    });
    expect(diagnostic.message).toContain('32 and 8 more fall outside');
  });

  it('leaves a key whose index text is not a valid int to the dispatcher', () => {
    // `_get_property` rsplits at the last `/` (property_list_helper.cpp:47), so `item_5/x/text` has
    // the index text `5/x`, which `is_valid_int` refuses: the key names no item at all.
    expectNoDiagnostic(scene(node('ItemList', { item_count: 1, 'item_5/x/text': '"x"' })), {
      ruleName: 'itemlist-item-index-out-of-range',
    });
  });
});

describe('ItemList index grammar', () => {
  it('errors on a `+`-signed index past item_count', () => {
    // `PropertyListHelper::_get_property` gates on `String::is_valid_int()`
    // (property_list_helper.cpp:53), which skips one leading `+` or `-`
    // (ustring.cpp:4752), so `item_+2/text` is item 2, past the count.
    expectDiagnostic(
      scene(node('ItemList', { item_count: 1, 'item_+2/text': '"Autosave"' })),
      {
        ruleName: 'itemlist-item-index-out-of-range',
        severity: 'error',
        nodeType: 'ItemList',
        contains: ['2', 'item_count (1)'],
      }
    );
  });
});
