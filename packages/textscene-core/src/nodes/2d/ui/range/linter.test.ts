/**
 * Range semantic rule: max_value below min_value.
 *
 * Godot does not reject this — `Range::set_max` clamps
 * (scene/gui/range.cpp:229: `double max_validated = MAX(p_max, shared->min);`)
 * — so the warning exists only because the collapse to a single-point range
 * is otherwise invisible: the .tscn keeps showing the authored (inverted)
 * numbers forever.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';
import './linter';

function scene(body: string): string {
  return `[gd_scene format=3]\n\n[node name="Root" type="Control"]\n\n[node name="MyRange" type="Range" parent="."]\n${body}`;
}

describe('Range bounds rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  const namesOf = (content: string) => linter.lint(content).map((d) => d.ruleName);
  const severitiesOf = (content: string, ruleName: string) =>
    linter.lint(content).filter((d) => d.ruleName === ruleName).map((d) => d.severity);

  it('says nothing about an ordinary, correctly-ordered range (happy path)', () => {
    const diagnostics = linter.lint(scene('min_value = 0\nmax_value = 100\n'));
    expect(diagnostics).toEqual([]);
  });

  it('warns when max_value is below min_value', () => {
    const content = scene('min_value = 10\nmax_value = 5\n');
    expect(namesOf(content)).toContain('range-max-below-min');
    expect(severitiesOf(content, 'range-max-below-min')).toEqual(['error']);
    expect(linter.lint(content)[0]!.message).toContain('max_value');
  });

  it('reports exactly one error and nothing else (severity contract)', () => {
    // `set_max` stores MAX(p_max, shared->min) and `set_min` re-raises max the
    // same way (range.cpp:217, :229), so the inverted pair is rewritten in
    // either load order: the ADR-0032 error tier, not an advisory.
    const diagnostics = linter.lint(scene('min_value = 10\nmax_value = 5\n'));
    expect(diagnostics.map((d) => [d.ruleName, d.severity])).toEqual([
      ['range-max-below-min', 'error'],
    ]);
  });

  it('stays silent when max_value equals min_value — a zero-width range is legal Godot (edge case)', () => {
    expect(namesOf(scene('min_value = 10\nmax_value = 10\n'))).not.toContain(
      'range-max-below-min'
    );
  });

  it('stays silent when only one of the pair is authored — nothing to compare (edge case)', () => {
    expect(namesOf(scene('max_value = 5\n'))).not.toContain('range-max-below-min');
    expect(namesOf(scene('min_value = 10\n'))).not.toContain('range-max-below-min');
  });

  it('stays silent when either bound is malformed — format errors are the validator’s job, not this rule’s', () => {
    expect(namesOf(scene('min_value = ten\nmax_value = 5\n'))).not.toContain(
      'range-max-below-min'
    );
  });

  it('leaves other node types alone', () => {
    const content = `[gd_scene format=3]\n\n[node name="Root" type="Control"]\nmin_value = 10\nmax_value = 5\n`;
    expect(namesOf(content)).not.toContain('range-max-below-min');
  });
});

describe('Range exp_edit rule (range-exp-edit-negative-min)', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  const namesOf = (content: string) => linter.lint(content).map((d) => d.ruleName);
  const severitiesOf = (content: string, ruleName: string) =>
    linter.lint(content).filter((d) => d.ruleName === ruleName).map((d) => d.severity);

  it('warns when exp_edit is true with a negative min_value', () => {
    const content = scene('exp_edit = true\nmin_value = -50.0\n');
    expect(namesOf(content)).toContain('range-exp-edit-negative-min');
    expect(severitiesOf(content, 'range-exp-edit-negative-min')).toEqual(['warning']);
  });

  it('stays silent when exp_edit is true but min_value is 0 or positive', () => {
    expect(namesOf(scene('exp_edit = true\nmin_value = 0.0\n'))).not.toContain(
      'range-exp-edit-negative-min'
    );
    expect(namesOf(scene('exp_edit = true\nmin_value = 5.0\n'))).not.toContain(
      'range-exp-edit-negative-min'
    );
  });

  it('stays silent when exp_edit is false, regardless of min_value', () => {
    expect(namesOf(scene('exp_edit = false\nmin_value = -50.0\n'))).not.toContain(
      'range-exp-edit-negative-min'
    );
  });

  it('stays silent when exp_edit is absent — its default is false (range.h:44)', () => {
    expect(namesOf(scene('min_value = -50.0\n'))).not.toContain('range-exp-edit-negative-min');
  });

  it('stays silent when min_value is absent — its default is 0.0 (range.h:40)', () => {
    expect(namesOf(scene('exp_edit = true\n'))).not.toContain('range-exp-edit-negative-min');
  });

  it('never raises an ERROR — this is a hinted advisory, not an engine-enforced bound', () => {
    const diagnostics = linter.lint(scene('exp_edit = true\nmin_value = -50.0\n'));
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('reports an inverted pair spelled with infinities', () => {
    expect(namesOf(scene('min_value = inf\nmax_value = 1.0\n'))).toContain('range-max-below-min');
    expect(namesOf(scene('min_value = 1.0\nmax_value = inf_neg\n'))).toContain(
      'range-max-below-min'
    );
  });

  it('stays silent on a nan pair, which MAX() does not collapse', () => {
    // range.cpp:217/229 run the pair through MAX(); every comparison against
    // nan is false, so nothing is clamped and there is no collapse to report.
    expect(namesOf(scene('min_value = nan\nmax_value = 1.0\n'))).not.toContain(
      'range-max-below-min'
    );
    expect(namesOf(scene('min_value = 1.0\nmax_value = nan\n'))).not.toContain(
      'range-max-below-min'
    );
  });

  it('warns on exp_edit with an infinitely negative min_value', () => {
    expect(namesOf(scene('exp_edit = true\nmin_value = inf_neg\n'))).toContain(
      'range-exp-edit-negative-min'
    );
  });

  it('stays silent on exp_edit with a nan min_value', () => {
    expect(namesOf(scene('exp_edit = true\nmin_value = nan\n'))).not.toContain(
      'range-exp-edit-negative-min'
    );
  });

  it('compares an exponent-spelled bound at its real magnitude', () => {
    // `parseFloat` read `2e1` as 2 and called this pair correctly ordered.
    expect(namesOf(scene('min_value = 2e1\nmax_value = 4.0\n'))).toContain('range-max-below-min');
  });

  it('reaches a concrete Range descendant (HSlider), not just the Range base', () => {
    const content = `[gd_scene format=3]\n\n[node name="Root" type="Control"]\n\n[node name="MySlider" type="HSlider" parent="."]\nexp_edit = true\nmin_value = -10.0\n`;
    expect(namesOf(content)).toContain('range-exp-edit-negative-min');
  });
});
