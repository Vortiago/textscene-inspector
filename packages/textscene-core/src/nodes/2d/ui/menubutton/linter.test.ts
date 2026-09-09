/**
 * Tests for MenuButton's semantic linter rule. Strict-parser format checks live
 * in linterParser.test.ts and are asserted through `validatorRegistry` there.
 *
 * Uses `Linter` via testkit, not the `linter/index.ts` barrel: that barrel
 * side-effect-imports every in-flight slice, so pulling it here would fail
 * flakily on a sibling's half-written file mid-wave.
 */

import { describe, it } from 'vitest';
import { node, scene, expectDiagnostic, expectNoDiagnostic } from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

const RULE = 'menubutton-item-index-out-of-range';

describe('MenuButton semantic rules', () => {
  it('errors when a popup/item_<N>/… index is >= item_count', () => {
    // `MenuButton::_set` (menu_button.cpp:176) gates only on
    // `is_property_valid`, which checks the prefix, `is_valid_int` and the leaf
    // name but NOT the length (property_list_helper.cpp:118-135). The write then
    // forwards to `popup->set(...)`, and PopupMenu's own helper refuses an index
    // at or past the array length (property_list_helper.cpp:58).
    expectDiagnostic(
      scene(
        node('MenuButton', {
          item_count: 2,
          'popup/item_0/text': '"Open"',
          'popup/item_2/text': '"Autosave"',
        })
      ),
      {
        ruleName: RULE,
        severity: 'error',
        nodeType: 'MenuButton',
        contains: ['2', 'item_count (2)'],
      }
    );
  });

  it('errors when item_count is absent, because the popup then holds no items', () => {
    // `MenuButton::get_item_count` forwards to `popup->get_item_count()`
    // (menu_button.cpp:134-135), and PopupMenu starts with an empty `items`
    // vector, which is the XML's default="0" the serialiser omits.
    expectDiagnostic(scene(node('MenuButton', { 'popup/item_0/text': '"Open"' })), {
      ruleName: RULE,
      severity: 'error',
      nodeType: 'MenuButton',
    });
  });

  it('errors on a `+`-signed index past item_count', () => {
    // `is_valid_int` skips ONE leading sign, `+` as readily as `-`
    // (ustring.cpp:4752), so `popup/item_+2/text` resolves to item 2.
    expectDiagnostic(
      scene(node('MenuButton', { item_count: 1, 'popup/item_+2/text': '"Autosave"' })),
      { ruleName: RULE, severity: 'error', contains: ['2'] }
    );
  });

  it('leaves a negative index to the per-property validator', () => {
    // The family dispatcher in linterParser.ts already errors on a negative
    // index, so reporting it here too would double the diagnostic.
    expectNoDiagnostic(
      scene(node('MenuButton', { item_count: 2, 'popup/item_-1/text': '"Open"' })),
      { ruleName: RULE }
    );
  });

  it('stays silent while every index is inside item_count', () => {
    expectNoDiagnostic(
      scene(
        node('MenuButton', {
          item_count: 2,
          'popup/item_0/text': '"Open"',
          'popup/item_1/text': '"Save"',
        })
      ),
      { ruleName: RULE }
    );
  });

  it('says nothing about a malformed item_count, which has its own validator', () => {
    expectNoDiagnostic(
      scene(node('MenuButton', { item_count: 'two', 'popup/item_9/text': '"Nine"' })),
      { ruleName: RULE }
    );
  });

  it('never reads a bare item_<N>/ key, which MenuButton does not expose', () => {
    // The prefix is `popup/item_` (menu_button.cpp:213); `item_0/text` matches
    // no property MenuButton declares and `_set` returns false for it.
    expectNoDiagnostic(scene(node('MenuButton', { item_count: 0, 'item_0/text': '"Open"' })), {
      ruleName: RULE,
    });
  });
});
