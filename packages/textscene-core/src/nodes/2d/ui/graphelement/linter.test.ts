/**
 * GraphElement semantic rule: `selected = true` authored with `selectable = false`.
 * `GraphElement::set_selectable(false)` forces `set_selected(false)` in either
 * load order (scene/gui/graph_element.cpp), so the .tscn shows a selection
 * that never loads.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';
import './linter';

function scene(body: string): string {
  return `[gd_scene format=3]\n\n[node name="Root" type="Control"]\n\n[node name="MyGraphElement" type="GraphElement" parent="."]\n${body}`;
}

describe('GraphElement selection rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  const namesOf = (content: string) => linter.lint(content).map((d) => d.ruleName);
  const severitiesOf = (content: string, ruleName: string) =>
    linter.lint(content).filter((d) => d.ruleName === ruleName).map((d) => d.severity);

  it('says nothing about an ordinary, consistent GraphElement (happy path)', () => {
    const diagnostics = linter.lint(scene('selectable = true\nselected = true\n'));
    expect(diagnostics).toEqual([]);
  });

  it('errors when selected = true is authored alongside selectable = false', () => {
    const content = scene('selectable = false\nselected = true\n');
    expect(namesOf(content)).toContain('graph-element-selected-not-selectable');
    expect(severitiesOf(content, 'graph-element-selected-not-selectable')).toEqual(['error']);
    expect(linter.lint(content)[0]!.message).toContain('selectable');
  });

  it('errors the same way regardless of which property is authored first (order independence)', () => {
    const content = scene('selected = true\nselectable = false\n');
    expect(namesOf(content)).toContain('graph-element-selected-not-selectable');
  });

  it('reports exactly one error and nothing else (severity contract)', () => {
    // `set_selectable(false)` calls `set_selected(false)` unconditionally
    // (graph_element.cpp:207), so the authored `selected` is overwritten: the
    // ADR-0032 error tier, and the only diagnostic this scene should produce.
    const diagnostics = linter.lint(scene('selectable = false\nselected = true\n'));
    expect(diagnostics.map((d) => [d.ruleName, d.severity])).toEqual([
      ['graph-element-selected-not-selectable', 'error'],
    ]);
  });

  it('stays silent when selectable = false and selected = false — nothing forced, nothing to warn about (edge case)', () => {
    expect(namesOf(scene('selectable = false\nselected = false\n'))).not.toContain(
      'graph-element-selected-not-selectable'
    );
  });

  it('stays silent when only one of the pair is authored — nothing to compare (edge case)', () => {
    expect(namesOf(scene('selected = true\n'))).not.toContain(
      'graph-element-selected-not-selectable'
    );
    expect(namesOf(scene('selectable = false\n'))).not.toContain(
      'graph-element-selected-not-selectable'
    );
  });

  it('stays silent when either value is malformed — format errors are the validator’s job, not this rule’s', () => {
    expect(namesOf(scene('selectable = maybe\nselected = true\n'))).not.toContain(
      'graph-element-selected-not-selectable'
    );
  });

  it('leaves other node types alone', () => {
    const content = `[gd_scene format=3]\n\n[node name="Root" type="Control"]\nselectable = false\nselected = true\n`;
    expect(namesOf(content)).not.toContain('graph-element-selected-not-selectable');
  });
});
