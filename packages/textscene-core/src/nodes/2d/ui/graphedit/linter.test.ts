/**
 * GraphEdit semantic rules: `zoom_min` authored above `zoom_max`, and a
 * `scroll_offset` the load clamps away.
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
import { graphEditPropertiesRule } from './linter';
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
  return graphEditPropertiesRule.check(context);
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
    expect(named('GraphEdit')).toContain('valid-graphedit-properties');
    expect(named('Control')).not.toContain('valid-graphedit-properties');
    expect(named('GraphNode')).not.toContain('valid-graphedit-properties');
  });
});

/** The rect `offset_left = 8 … offset_bottom = 328` gives: 400 by 320. */
const SIZED_400_320 =
  'offset_left = 8.0\noffset_top = 8.0\noffset_right = 408.0\noffset_bottom = 328.0\n';

describe('GraphEdit scroll_offset rule', () => {
  it('reports a positive authored offset, naming what Godot stores instead', () => {
    // `p_offset.clamp(min_scroll_offset, max_scroll_offset - get_size())`
    // (graph_edit.cpp:407) with both bounds still (0, 0), and CLAMP testing its
    // min first (typedefs.h:139-141), sends every non-negative component to
    // -size.
    const diagnostics = diagnose(`${SIZED_400_320}scroll_offset = Vector2(32, 16)\n`);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.ruleName).toBe('graphedit-scroll-offset-discarded');
    expect(diagnostics[0]!.message).toContain("scroll_offset = Vector2(32, 16)");
    expect(diagnostics[0]!.message).toContain('Vector2(-400, -320)');
  });

  it('reports it as info, because nothing is refused and nothing is out of bounds', () => {
    // ADD_PROPERTY binds scroll_offset PROPERTY_HINT_NONE (graph_edit.cpp:3069)
    // and the setter has no ERR_FAIL. The claim is that the clamp reads load
    // state no child has filled in yet: an `engine-inert` grounding, which
    // severityFixedBy pins at info.
    expect(diagnose(`${SIZED_400_320}scroll_offset = Vector2(32, 16)\n`)[0]!.severity).toBe('info');
  });

  it('reports a negative authored offset, which the min branch sends to (0, 0)', () => {
    const diagnostics = diagnose(`${SIZED_400_320}scroll_offset = Vector2(-64, -48)\n`);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.message).toContain('Vector2(0, 0)');
  });

  it('says that omitting the property is what an explicit (0, 0) does not do', () => {
    // The whole point of the rule: writing the class default stores -size while
    // leaving the line out stores (0, 0).
    const diagnostics = diagnose(`${SIZED_400_320}scroll_offset = Vector2(0, 0)\n`);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.message).toContain('Vector2(-400, -320)');
    expect(diagnostics[0]!.message).toContain('Omitting the property');
  });

  it('adds that clause only where the authored value IS the default', () => {
    expect(diagnose(`${SIZED_400_320}scroll_offset = Vector2(32, 16)\n`)[0]!.message).not.toContain(
      'Omitting the property'
    );
  });

  it('stays silent where the file never writes the property', () => {
    expect(diagnose(SIZED_400_320)).toEqual([]);
  });

  it('stays silent on an explicit (0, 0) in a GraphEdit with no rect', () => {
    // Both clamp ends are 0 - 0, so the write stores exactly what it asked for
    // and there is nothing the author could be surprised by.
    expect(diagnose('scroll_offset = Vector2(0, 0)\n')).toEqual([]);
  });

  it('stays silent on a value the Vector2 grammar refuses, which is the validator’s job', () => {
    expect(diagnose(`${SIZED_400_320}scroll_offset = sideways\n`)).toEqual([]);
    expect(diagnose(`${SIZED_400_320}scroll_offset = Vector2(inf, 0)\n`)).toEqual([]);
    expect(diagnose(`${SIZED_400_320}scroll_offset = Vector2(nan, nan)\n`)).toEqual([]);
  });

  it('reads the Vector2i spelling Godot converts into the slot', () => {
    const diagnostics = diagnose(`${SIZED_400_320}scroll_offset = Vector2i(32, 16)\n`);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.message).toContain('Vector2(-400, -320)');
  });

  it('stays silent where a preceding zoom write widened the bounds first', () => {
    // `zoom = 2.0` moves the value, so set_zoom_custom runs _update_scrollbars
    // (graph_edit.cpp:2448) and the clamp that follows spans -size to 0, where
    // this offset survives untouched.
    expect(diagnose(`${SIZED_400_320}zoom = 2.0\nscroll_offset = Vector2(-64, -48)\n`)).toEqual([]);
  });

  it('still reports an offset those widened bounds also clamp', () => {
    const diagnostics = diagnose(`${SIZED_400_320}zoom = 2.0\nscroll_offset = Vector2(32, 16)\n`);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.message).toContain('Vector2(0, 0)');
  });

  it('measures the size from the offsets written BEFORE it', () => {
    // set_scroll_offset reads get_size() as the keys so far left it, so the
    // same pair of values reports a different stored offset in the other order.
    const diagnostics = diagnose(`scroll_offset = Vector2(32, 16)\n${SIZED_400_320}`);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.message).toContain('Vector2(0, 0)');
  });
});
