/**
 * GraphEdit semantic rule: `zoom_min` authored above `zoom_max`.
 *
 * Driven through the rule's own `check`, over a scene the STRICT parser built,
 * rather than through `Linter`: `Linter` imports the linter barrel and so loads
 * every slice in the repo, which is unusable while sibling slices are being
 * written. `StrictTscnParser` pulls no barrel, so the node this feeds the rule
 * is still the real parser's output rather than a hand-built literal.
 */

import { describe, expect, it } from 'vitest';
import { StrictTscnParser } from '../../../../linter/StrictTscnParser';
import { ruleRegistry } from '../../../../linter/RuleRegistry';
import type { Diagnostic, RuleContext } from '../../../../linter/types';
import type { TscnNode } from '../../../../types';
import { graphEditZoomLimitsRule } from './linter';
import './linterParser';

/** Run the rule over the single GraphEdit in a one-node scene. */
function diagnose(body: string): Diagnostic[] {
  const content =
    `[gd_scene format=3]\n\n[node name="Root" type="Control"]\n\n` +
    `[node name="MyGraphEdit" type="GraphEdit" parent="."]\n${body}`;
  const { scene } = new StrictTscnParser().parse(content);
  const node = scene.nodes[0]?.children[0] as TscnNode;
  expect(node.type).toBe('GraphEdit');
  const context: RuleContext = { scene, node, properties: node.properties };
  return graphEditZoomLimitsRule.check(context);
}

describe('GraphEdit zoom-limit rule', () => {
  it('says nothing about limits authored in the right order', () => {
    expect(diagnose('zoom_min = 0.25\nzoom_max = 4.0\n')).toEqual([]);
  });

  it('warns when zoom_min is authored above zoom_max', () => {
    const diagnostics = diagnose('zoom_min = 4.0\nzoom_max = 0.25\n');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.ruleName).toBe('graphedit-zoom-min-above-max');
    expect(diagnostics[0]!.message).toContain('zoom_min');
    expect(diagnostics[0]!.message).toContain('zoom_max');
  });

  it('never raises an error, only a warning', () => {
    // Both values are things Godot's parser reads perfectly well; what breaks
    // is that one of the two SETTERS refuses its write. That is invisible
    // rather than malformed, so it is advisory.
    expect(diagnose('zoom_min = 4.0\nzoom_max = 0.25\n')[0]!.severity).toBe('warning');
  });

  it('stays silent on an equal pair, which both guards permit', () => {
    // graph_edit.cpp:2480 fails on `>` and graph_edit.cpp:2495 on `<`, so
    // zoom_min == zoom_max is a legal, if frozen, zoom range.
    expect(diagnose('zoom_min = 2.0\nzoom_max = 2.0\n')).toEqual([]);
  });

  it('stays silent when only one limit is authored', () => {
    // The other side is then whatever GraphEdit's constructor computed
    // (graph_edit.cpp:3175, 3177), which this rule deliberately does not model.
    expect(diagnose('zoom_min = 4.0\n')).toEqual([]);
    expect(diagnose('zoom_max = 0.25\n')).toEqual([]);
  });

  it('stays silent when either limit is malformed, which is the validator’s job', () => {
    expect(diagnose('zoom_min = wide\nzoom_max = 0.25\n')).toEqual([]);
  });

  it('is offered only to GraphEdit nodes', () => {
    // Applicability is the REGISTRY's filter, not `check`'s: linter/types.ts
    // forbids a rule re-testing its own node type inside `check`, since the
    // duplicate predicate can drift from the declared one. So the seam for
    // "leaves other types alone" is `getRulesForNodeType`.
    const named = (type: string) =>
      ruleRegistry.getRulesForNodeType(type).map((rule) => rule.meta.name);
    expect(named('GraphEdit')).toContain('valid-graphedit-zoom-limits');
    expect(named('Control')).not.toContain('valid-graphedit-zoom-limits');
    expect(named('GraphNode')).not.toContain('valid-graphedit-zoom-limits');
  });
});
