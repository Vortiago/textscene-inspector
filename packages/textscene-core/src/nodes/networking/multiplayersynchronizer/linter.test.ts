/**
 * The MultiplayerSynchronizer root_path rule (`multiplayersynchronizer-root-path-dangling`), driven
 * through `StrictTscnParser` and the rule's own `check`, not `Linter`, which loads every slice
 * through the linter barrel. The parse is the real one, so the rule reads what a scene produces.
 */

import { describe, expect, it } from 'vitest';
import { StrictTscnParser } from '../../../linter/StrictTscnParser';
import { readFixture } from '../../../linter/testing/fixtureCheck';
import { multiplayerSynchronizerRootPathRule } from './linter';
import './linterParser';

/** Every diagnostic the rule reports for the MultiplayerSynchronizer in `content`. */
function warningsFor(content: string) {
  const { scene } = new StrictTscnParser().parse(content);
  if (!scene) throw new Error('fixture failed to parse');
  const node = scene.nodes[0]?.children.find((child) => child.type === 'MultiplayerSynchronizer');
  expect(node, 'the fixture text must contain a MultiplayerSynchronizer child').toBeDefined();
  return multiplayerSynchronizerRootPathRule.check({ scene, node: node!, properties: node!.properties });
}

/** A MultiplayerSynchronizer carrying `body`, with a child named SyncTarget to point at. */
function scene(body: string): string {
  return `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="Sync" type="MultiplayerSynchronizer" parent="."]
${body}
[node name="SyncTarget" type="Node" parent="Sync"]
`;
}

describe('MultiplayerSynchronizer root_path rule', () => {
  it('stays silent when root_path is absent (default is NodePath(".."), not empty)', () => {
    expect(warningsFor(scene(''))).toEqual([]);
  });

  it('stays silent on an explicit NodePath("..") — the same relative escape as the default', () => {
    expect(warningsFor(scene('root_path = NodePath("..")\n'))).toEqual([]);
  });

  it('stays silent when root_path resolves to a real node', () => {
    expect(warningsFor(scene('root_path = NodePath("SyncTarget")\n'))).toEqual([]);
  });

  it('warns when root_path names no node in this file', () => {
    const warnings = warningsFor(scene('root_path = NodePath("NoSuchNode")\n'));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.severity).toBe('warning');
    expect(warnings[0]?.ruleName).toBe('multiplayersynchronizer-root-path-dangling');
    expect(warnings[0]?.message).toContain('NoSuchNode');
  });

  it('leaves the committed fixture warning-free', () => {
    // expectFixtureClean runs validators only; rules never reach it. This is
    // the half of the fixture's "zero warnings" claim nothing else checks.
    expect(warningsFor(readFixture('unit-multiplayer-synchronizer.tscn'))).toEqual([]);
  });
});
