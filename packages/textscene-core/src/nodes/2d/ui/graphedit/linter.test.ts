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
import type { TscnNode } from '../../../../parser/types';
import { graphEditZoomLimitsRule } from './linter';
import './linterParser';

/** Run the rule over the single GraphEdit in a one-node scene. */
function diagnose(body: string): Diagnostic[] {
  const content =
    `[gd_scene format=3]\n\n[node name="Root" type="Control"]\n\n` +
    `[node name="MyGraphEdit" type="GraphEdit" parent="."]\n${body}`;
  const { scene } = new StrictTscnParser().parse(content);
  if (!scene) throw new Error("fixture failed to parse");
  const node = scene.nodes[0]?.children[0] as TscnNode;
  expect(node.type).toBe('GraphEdit');
  const context: RuleContext = { scene, node, properties: node.properties };
  return graphEditZoomLimitsRule.check(context);
}

describe('GraphEdit zoom-limit rule', () => {
  it('says nothing about limits authored in the right order', () => {
    expect(diagnose('zoom_min = 0.25\nzoom_max = 4.0\n')).toEqual([]);
  });

  it('reports zoom_min authored above zoom_max, naming both properties', () => {
    const diagnostics = diagnose('zoom_min = 4.0\nzoom_max = 0.25\n');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.ruleName).toBe('graphedit-zoom-min-above-max');
    expect(diagnostics[0]!.message).toContain('zoom_min');
    expect(diagnostics[0]!.message).toContain('zoom_max');
  });

  it('reports an error, because a setter refuses one of the two writes', () => {
    // Both values are things Godot's parser reads perfectly well, so this is
    // not a format failure. It is the ADR-0032 error tier all the same:
    // set_zoom_min / set_zoom_max guard against each other, so whichever the
    // loader applies second is dropped and that limit keeps its constructor
    // default rather than the authored one.
    expect(diagnose('zoom_min = 4.0\nzoom_max = 0.25\n')[0]!.severity).toBe('error');
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

  it('reports an inverted pair spelled with infinities', () => {
    // `inf` is a float literal the tokenizer reads (variant_parser.cpp:701-707)
    // and the writer emits, so this is a file Godot produces and reloads — and
    // graph_edit.cpp:2480 compares it like any other double.
    expect(diagnose('zoom_min = inf\nzoom_max = 1.0\n')).toHaveLength(1);
    expect(diagnose('zoom_min = 1.0\nzoom_max = inf_neg\n')).toHaveLength(1);
  });

  it('stays silent on a nan pair, which neither setter refuses', () => {
    // Both guards are strict comparisons, and every comparison against nan is
    // false, so nan passes graph_edit.cpp:2480 and :2495 and BOTH limits land.
    // There is no dropped limit to report.
    expect(diagnose('zoom_min = nan\nzoom_max = 1.0\n')).toEqual([]);
    expect(diagnose('zoom_min = 4.0\nzoom_max = nan\n')).toEqual([]);
    expect(diagnose('zoom_min = nan\nzoom_max = nan\n')).toEqual([]);
  });

  it('compares an exponent-spelled limit at its real magnitude', () => {
    // `parseFloat` reads `2e1` as 2 and called this pair correctly ordered.
    expect(diagnose('zoom_min = 2e1\nzoom_max = 4.0\n')).toHaveLength(1);
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
