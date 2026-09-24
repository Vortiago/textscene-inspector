/**
 * Tests the OptionButton advisory on `selected` against `item_count`. It warns, not errors, since the
 * outcome depends on property order, which the rule cannot see (linter.ts).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { node, scene, lint } from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

// Each assertion filters by this rule's `ruleName`: `lint()` shares one process-wide rule registry that
// holds every slice's rules, so a whole-scene "clean" check would depend on every other rule that reaches
// OptionButton, for example through BaseButton or Control.
describe('optionbutton-selected-out-of-range', () => {
  const findings = (content: string) =>
    lint(content).filter((d) => d.ruleName === 'optionbutton-selected-out-of-range');

  it('stays silent when selected indexes a real item', () => {
    expect(findings(scene(node('OptionButton', { item_count: 3, selected: 1 })))).toHaveLength(0);
  });

  it('stays silent on "none selected" (-1), regardless of item_count', () => {
    expect(findings(scene(node('OptionButton', { item_count: 0, selected: -1 })))).toHaveLength(0);
  });

  it('stays silent when selected is absent', () => {
    expect(findings(scene(node('OptionButton', { item_count: 3 })))).toHaveLength(0);
  });

  it('reads an exponent-spelled item_count at its real size', () => {
    expect(
      findings(scene(node('OptionButton', { item_count: '2e1', selected: 15 })))
    ).toHaveLength(0);
  });

  it('says nothing when either side is non-finite, since neither is a stored index', () => {
    expect(findings(scene(node('OptionButton', { item_count: 'inf', selected: 15 })))).toHaveLength(
      0
    );
    expect(findings(scene(node('OptionButton', { item_count: 3, selected: 'inf' })))).toHaveLength(
      0
    );
  });

  it('warns when selected equals item_count (one past the last valid index)', () => {
    const found = findings(scene(node('OptionButton', { item_count: 3, selected: 3 })));
    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe('warning');
  });

  it('warns when selected exceeds item_count', () => {
    expect(findings(scene(node('OptionButton', { item_count: 3, selected: 10 })))).toHaveLength(1);
  });

  it('warns when selected is set but item_count is absent (defaults to 0, doc/classes/OptionButton.xml:240)', () => {
    expect(findings(scene(node('OptionButton', { selected: 0 })))).toHaveLength(1);
  });

  it('does not double-count a below-floor selected: linterParser.ts already errors on that as a format/range violation', () => {
    // -2 is caught by the single-property validator (option_button.cpp:433);
    // this rule only looks at non-negative values, so it stays silent here.
    expect(findings(scene(node('OptionButton', { item_count: 3, selected: -2 })))).toHaveLength(0);
  });

  it('stays silent on the real fixture (selected = 1 within item_count = 3)', () => {
    // This rule's share of the zero-diagnostic claim. linterParser.test.ts checks every validator
    // through `findValidator`, with no shared rule registry.
    const fixturePath = join(
      import.meta.dirname,
      '../../../../../../../scenes/fixtures/unit-optionbutton.tscn'
    );
    expect(findings(readFileSync(fixturePath, 'utf8'))).toHaveLength(0);
  });
});
