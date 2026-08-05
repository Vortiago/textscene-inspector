/**
 * Tree semantic rule: the one cross-field condition Tree has.
 *
 * Driven through the rule's own `check`, over a scene parsed by
 * `StrictTscnParser`, rather than through `Linter`: the barrel is mid-wave and
 * `Linter`-based helpers would pull it in. Applicability is the registry's job
 * (`RuleRegistry.getRulesForNodeType`), so these cases hand `check` a Tree node
 * directly and assert only what it reports.
 */

import { describe, expect, it } from 'vitest';
import { StrictTscnParser } from '../../../../linter/StrictTscnParser';
import { ruleRegistry } from '../../../../linter/RuleRegistry';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import type { Diagnostic, RuleContext } from '../../../../linter/types';
import './linterParser';
import { treeScrollHintRule } from './linter';

/** Diagnostics the rule reports for a `[node type="Tree"]` carrying `properties`. */
function checkTree(properties: string): Diagnostic[] {
  const source = `[gd_scene format=3]

[node name="Root" type="Control"]

[node name="MyTree" type="Tree" parent="."]
${properties}`;
  const { scene } = new StrictTscnParser().parse(source);
  const node = scene?.nodes[0]?.children[0];
  expect(node?.type, 'the fixture text must yield a Tree node').toBe('Tree');
  const context: RuleContext = { scene: scene!, node: node!, properties: node!.properties };
  return treeScrollHintRule.check(context);
}

describe('Tree semantic rules', () => {
  it('registers the rule so the linter actually runs it', () => {
    expect(ruleRegistry.getRulesForNodeType('Tree').map((rule) => rule.meta.name)).toContain(
      'valid-tree-scroll-hint'
    );
  });

  it('warns when tiling is enabled but the hint itself never draws', () => {
    // tree.cpp:5193 opens `if (scroll_hint_mode != SCROLL_HINT_MODE_DISABLED)`
    // and closes at 5206; tile_scroll_hint is read only at 5200 and 5203, both
    // inside it. Godot omits the default scroll_hint_mode = 0, so the absent
    // key IS the disabled case.
    const diagnostics = checkTree('tile_scroll_hint = true\n');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.severity).toBe('warning');
    expect(diagnostics[0]?.ruleName).toBe('tree-tile-scroll-hint-without-hints');
    expect(diagnostics[0]?.message).toContain('scroll_hint_mode');
  });

  it('warns when scroll_hint_mode is spelled out as SCROLL_HINT_MODE_DISABLED', () => {
    const diagnostics = checkTree('scroll_hint_mode = 0\ntile_scroll_hint = true\n');
    expect(diagnostics.map((d) => d.ruleName)).toEqual(['tree-tile-scroll-hint-without-hints']);
  });

  it.each(['1', '2', '3'])('is silent when scroll_hint_mode is %s', (mode) => {
    expect(checkTree(`scroll_hint_mode = ${mode}\ntile_scroll_hint = true\n`)).toEqual([]);
  });

  it('is silent when tiling is off, which is the default and changes nothing', () => {
    expect(checkTree('tile_scroll_hint = false\n')).toEqual([]);
  });

  it('is silent on a Tree that sets neither key', () => {
    expect(checkTree('columns = 2\n')).toEqual([]);
  });

  it.each(['maybe', '', ' '])(
    'stays silent on the unreadable scroll_hint_mode "%s", which the validator owns',
    (mode) => {
      // Reporting a dead setting on top of a value nobody can read would be a
      // second diagnostic for one defect. The empty and whitespace forms matter
      // because `Number('')` is 0, which would otherwise read as DISABLED.
      expect(checkTree(`scroll_hint_mode = ${mode}\ntile_scroll_hint = true\n`)).toEqual([]);
    }
  );

  it('warns on a hand-written 0.0, which Godot still reads as DISABLED', () => {
    // Godot's serialiser never spells an INT property that way, but its parser
    // reads the float and the enum conversion truncates it to 0, so the setting
    // is just as dead as a plain 0. The rule reads the value the same way the
    // validator does rather than demanding an integer spelling.
    expect(checkTree('scroll_hint_mode = 0.0\ntile_scroll_hint = true\n')).toHaveLength(1);
  });

  it('is silent on the committed fixture, which claims zero warnings', () => {
    // expectFixtureClean covers the validators; rules run in a separate phase,
    // so the fixture's warning-free claim needs this half asserted too.
    const { scene } = new StrictTscnParser().parse(readFixture('unit-tree.tscn'));
    const tree = scene?.nodes[0]?.children[0];
    expect(tree?.type).toBe('Tree');
    expect(
      treeScrollHintRule.check({ scene: scene!, node: tree!, properties: tree!.properties })
    ).toEqual([]);
  });
});
