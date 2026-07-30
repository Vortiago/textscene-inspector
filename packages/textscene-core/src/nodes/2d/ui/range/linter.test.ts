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
    expect(severitiesOf(content, 'range-max-below-min')).toEqual(['warning']);
    expect(linter.lint(content)[0]!.message).toContain('max_value');
  });

  it('never raises an ERROR — Godot clamps rather than rejects (severity contract)', () => {
    const diagnostics = linter.lint(scene('min_value = 10\nmax_value = 5\n'));
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
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
