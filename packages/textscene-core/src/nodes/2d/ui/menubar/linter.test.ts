/**
 * Tests for MenuBar's semantic linter rule (strict-parser format checks live in
 * linterParser.test.ts and are asserted through validatorRegistry there).
 *
 * Calls `menuBarNoPopupMenuRule.check(...)` directly with a hand-built
 * `RuleContext` rather than going through `Linter` or `ruleRegistry`: both run
 * every rule the GLOBAL registry singleton happens to hold, which during a
 * concurrent wave is whatever sibling slices another test file has imported.
 * The exported rule object reaches only this slice.
 */

import { describe, expect, it } from 'vitest';
import type { RuleContext } from '../../../../linter/types';
import type { TscnNode, TscnScene } from '../../../../parser/types';
import { StrictTscnParser } from '../../../../linter/StrictTscnParser';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import { menuBarNoPopupMenuRule } from './linter';

/** Depth-first search for the first node of a type, over a parsed scene tree. */
function findByType(nodes: TscnNode[], type: string): TscnNode | undefined {
  for (const node of nodes) {
    if (node.type === type) return node;
    const found = findByType(node.children ?? [], type);
    if (found) return found;
  }
  return undefined;
}

function makeContext(children: Partial<TscnNode>[]): RuleContext {
  const node: TscnNode = {
    name: 'MyMenuBar',
    type: 'MenuBar',
    children: children.map((child) => ({
      name: 'Child',
      type: 'Node',
      children: [],
      properties: {},
      ...child,
    })),
    properties: {},
  };
  const scene: TscnScene = { nodes: [node], externalResources: [], internalResources: [] };
  return { scene, node, properties: node.properties };
}

describe('MenuBar semantic rules', () => {
  it('warns when the MenuBar has no children at all', () => {
    const diagnostics = menuBarNoPopupMenuRule.check(makeContext([]));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.severity).toBe('warning');
    expect(diagnostics[0]?.ruleName).toBe('menubar-no-popupmenu');
    expect(diagnostics[0]?.nodeName).toBe('MyMenuBar');
  });

  it('warns when every child is something other than a PopupMenu', () => {
    // add_child_notify (menu_bar.cpp:606-609) returns early on a child that does
    // not cast to PopupMenu, so these never reach menu_cache and never draw.
    const diagnostics = menuBarNoPopupMenuRule.check(
      makeContext([
        { name: 'File', type: 'Button' },
        { name: 'Spacer', type: 'Control' },
      ])
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('PopupMenu');
  });

  it('stays silent for a single PopupMenu child', () => {
    expect(
      menuBarNoPopupMenuRule.check(makeContext([{ name: 'File', type: 'PopupMenu' }]))
    ).toEqual([]);
  });

  it('stays silent when a PopupMenu sits among other children', () => {
    // Non-PopupMenu siblings are legal: Godot just ignores them for the bar.
    expect(
      menuBarNoPopupMenuRule.check(
        makeContext([
          { name: 'Decoration', type: 'ColorRect' },
          { name: 'File', type: 'PopupMenu' },
        ])
      )
    ).toEqual([]);
  });

  it('stays silent when a child is an instanced sub-scene', () => {
    // Instance-opaque linting: an `instance=` child has no type here, and the
    // sub-scene it points at may well be rooted at a PopupMenu.
    expect(
      menuBarNoPopupMenuRule.check(
        makeContext([{ name: 'FileMenu', type: '', instance: 'ExtResource("1_menu")' }])
      )
    ).toEqual([]);
  });

  it('warns once for a MenuBar with many non-PopupMenu children', () => {
    const diagnostics = menuBarNoPopupMenuRule.check(
      makeContext([
        { name: 'A', type: 'Button' },
        { name: 'B', type: 'Button' },
        { name: 'C', type: 'Label' },
      ])
    );
    expect(diagnostics).toHaveLength(1);
  });

  it('stays silent on the committed fixture, which the rule is part of the clean claim for', () => {
    // Parsed through StrictTscnParser rather than a hand-built context, because
    // the thing under test here is the fixture's real child tree.
    const { scene } = new StrictTscnParser().parse(readFixture('unit-menu-bar.tscn'));
    const menuBar = findByType(scene.nodes, 'MenuBar');
    expect(menuBar, 'unit-menu-bar.tscn no longer contains a MenuBar').toBeDefined();
    expect(
      menuBarNoPopupMenuRule.check({ scene, node: menuBar!, properties: menuBar!.properties })
    ).toEqual([]);
  });

  it('applies only to MenuBar', () => {
    expect(menuBarNoPopupMenuRule.meta.applicableNodeTypes).toEqual(['MenuBar']);
    expect(menuBarNoPopupMenuRule.meta.emits).toEqual([
      { ruleName: 'menubar-no-popupmenu', severity: 'warning' },
    ]);
  });
});
