/**
 * TabBar cross-field advisories: `current_tab` and each `tab_<idx>/<leaf>` index against `tab_count`.
 * Driven through `StrictTscnParser` and the rule's `check`, not `Linter`: the rule registry is
 * process-wide, so `Linter` would also run every other loaded slice's rules.
 */

import { describe, expect, it } from 'vitest';
import { StrictTscnParser } from '../../../../linter/StrictTscnParser';
import { ruleRegistry } from '../../../../linter/RuleRegistry';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import type { Diagnostic } from '../../../../linter/types';
import type { TscnNode } from '../../../../parser/types';
import './linterParser';
import { tabBarValidationRule } from './linter';

/** Depth-first search for the first TabBar in a parsed tree. */
function findTabBar(nodes: readonly TscnNode[]): TscnNode | undefined {
  for (const node of nodes) {
    if (node.type === 'TabBar') return node;
    const inChildren = findTabBar(node.children);
    if (inChildren) return inChildren;
  }
  return undefined;
}

/** Run the rule over a scene's TabBar, the way `Linter.lintNode` would. */
function lintContent(content: string): Diagnostic[] {
  const result = new StrictTscnParser().parse(content);
  const scene = result.scene;
  expect(scene, 'the scanner must produce a tree for the rule to read').toBeDefined();
  const node = findTabBar(scene!.nodes);
  expect(node, 'the scene text must declare a TabBar').toBeDefined();
  return tabBarValidationRule.check({ scene: scene!, node: node!, properties: node!.properties });
}

/** A single TabBar root carrying `props`, verbatim. */
function findings(props: Record<string, string | number | boolean>): Diagnostic[] {
  const body = Object.entries(props)
    .map(([key, value]) => `${key} = ${String(value)}`)
    .join('\n');
  return lintContent(`[gd_scene format=3]\n\n[node name="Tabs" type="TabBar"]\n${body}\n`);
}

describe('TabBar cross-field rule', () => {
  it('is registered for TabBar', () => {
    const names = ruleRegistry.getRulesForNodeType('TabBar').map((rule) => rule.meta.name);
    expect(names).toContain('valid-tabbar-properties');
  });

  describe('tabbar-current-tab-out-of-range', () => {
    const only = (props: Record<string, string | number | boolean>) =>
      findings(props).filter((d) => d.ruleName === 'tabbar-current-tab-out-of-range');

    it('stays silent when current_tab indexes a real tab', () => {
      expect(only({ tab_count: 3, current_tab: 1 })).toHaveLength(0);
    });
    it('stays silent on the last valid index', () => {
      expect(only({ tab_count: 3, current_tab: 2 })).toHaveLength(0);
    });
    it('stays silent on -1, the deselect sentinel, whatever tab_count says', () => {
      expect(only({ tab_count: 0, current_tab: -1 })).toHaveLength(0);
      expect(only({ tab_count: 3, current_tab: -1 })).toHaveLength(0);
    });
    it('stays silent when current_tab is absent (it defaults to -1)', () => {
      expect(only({ tab_count: 3 })).toHaveLength(0);
    });
    it('errors when current_tab equals tab_count, one past the last valid index', () => {
      const found = only({ tab_count: 3, current_tab: 3 });
      expect(found).toHaveLength(1);
      expect(found[0]?.severity).toBe('error');
    });
    it('errors when current_tab exceeds tab_count', () => {
      expect(only({ tab_count: 3, current_tab: 9 })).toHaveLength(1);
    });
    it('errors when current_tab is set but tab_count never is: the count defaults to 0, so no index is selectable', () => {
      expect(only({ current_tab: 0 })).toHaveLength(1);
    });
    it('leaves a below-floor current_tab to linterParser.ts, which already errors on it', () => {
      expect(only({ tab_count: 3, current_tab: -2 })).toHaveLength(0);
    });
    it('reads an exponent-spelled tab_count at its real size', () => {
      // `2e1` is 20. A `parseInt` that stops at the `e` reads 2 and reports tab 15 out of range at
      // error tier on a file Godot loads.
      expect(only({ tab_count: '2e1', current_tab: 15 })).toHaveLength(0);
    });
    it('says nothing about a non-finite tab_count, which is altered at parse', () => {
      expect(only({ tab_count: 'inf', current_tab: 15 })).toHaveLength(0);
    });
    it('says nothing about a malformed tab_count, which has its own validator', () => {
      expect(only({ tab_count: 'three', current_tab: 1 })).toHaveLength(0);
    });
  });

  describe('tabbar-tab-index-out-of-range', () => {
    const only = (props: Record<string, string | number | boolean>) =>
      findings(props).filter((d) => d.ruleName === 'tabbar-tab-index-out-of-range');

    it('stays silent when every tab index is inside tab_count', () => {
      expect(
        only({ tab_count: 2, 'tab_0/title': '"One"', 'tab_1/title': '"Two"' })
      ).toHaveLength(0);
    });
    it('stays silent when no tab_<idx>/ key is present at all', () => {
      expect(only({ tab_count: 2 })).toHaveLength(0);
    });
    it('errors on an index at tab_count, the first index the array does not hold', () => {
      const found = only({ tab_count: 2, 'tab_2/title': '"Three"' });
      expect(found).toHaveLength(1);
      expect(found[0]?.severity).toBe('error');
    });
    it('errors once, listing every offending index, rather than once per key', () => {
      const found = only({
        tab_count: 1,
        'tab_0/title': '"One"',
        'tab_3/title': '"Four"',
        'tab_3/disabled': 'true',
        'tab_5/title': '"Six"',
      });
      expect(found).toHaveLength(1);
      expect(found[0]?.message).toContain('3, 5');
    });
    it('errors when a tab_<idx>/ key appears with no tab_count at all', () => {
      expect(only({ 'tab_0/title': '"One"' })).toHaveLength(1);
    });
    it('never claims the tab_-prefixed scalars are indexed keys', () => {
      expect(
        only({ tab_count: 0, tab_alignment: 1, tab_close_display_policy: 2 })
      ).toHaveLength(0);
    });
    it('leaves a negative index to linterParser.ts, which already errors on it', () => {
      expect(only({ tab_count: 1, 'tab_-1/title': '"Ghost"' })).toHaveLength(0);
    });
    it('says nothing about a malformed tab_count, which has its own validator', () => {
      expect(only({ tab_count: 'three', 'tab_9/title': '"Nine"' })).toHaveLength(0);
    });
    // `int index = ….to_int()` (property_list_helper.cpp:57) keeps the low 32 bits.
    it('applies an index that wraps past 32 bits to the tab it lands on', () => {
      expect(only({ tab_count: 1, 'tab_4294967296/title': '"x"' })).toHaveLength(0);
    });
    it('names what Godot stores beside a wrapping index past the count', () => {
      const found = only({ tab_count: 1, 'tab_4294967297/title': '"x"' });
      expect(found).toHaveLength(1);
      expect(found[0]?.message).toContain('tab index(es) 4294967297 (stored as 1) but');
    });
    // INT64_MAX (ustring.cpp:2283-2284) keeps -1, which linterParser.ts reports.
    it('leaves an index that saturates to INT64_MAX to the negative-index refusal', () => {
      expect(only({ tab_count: 2, 'tab_9999999999999999999999/title': '"x"' })).toHaveLength(0);
    });
    it('caps the list it names, however many tabs fall outside', () => {
      const tabs = Object.fromEntries(
        Array.from({ length: 40 }, (_, i) => [`tab_${i + 1}/title`, '"x"'])
      );
      const found = only({ tab_count: 1, ...tabs });
      expect(found).toHaveLength(1);
      expect(found[0]?.message).toContain('32 and 8 more but');
    });
    it('leaves a key whose index text is not a valid int to the dispatcher', () => {
      // `_get_property` rsplits at the last `/` (property_list_helper.cpp:47), so `tab_5/x/title`
      // has the index text `5/x`, which `is_valid_int` refuses: the key names no tab at all.
      expect(only({ tab_count: 1, 'tab_5/x/title': '"x"' })).toHaveLength(0);
    });
  });

  it('reports nothing on the committed fixture', () => {
    expect(lintContent(readFixture('unit-tab-bar.tscn'))).toEqual([]);
  });
});

describe('TabBar index grammar', () => {
  /** Only the out-of-range diagnostics, the way the block above filters. */
  const only = (props: Record<string, string | number>): Diagnostic[] =>
    lintContent(
      `[gd_scene format=3]\n\n[node name="Bar" type="TabBar"]\n` +
        Object.entries(props)
          .map(([key, value]) => `${key} = ${value}`)
          .join('\n') +
        '\n'
    ).filter((d) => d.ruleName === 'tabbar-tab-index-out-of-range');

  it('errors on a `+`-signed index past tab_count', () => {
    // `is_valid_int` skips one leading sign, `+` as readily as `-`
    // (ustring.cpp:4752), so `tab_+2/title` resolves to tab 2 and
    // `_get_property` drops it for being past the count
    // (property_list_helper.cpp:58).
    const found = only({ tab_count: 1, 'tab_+2/title': '"Three"' });
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain('2');
  });
});
