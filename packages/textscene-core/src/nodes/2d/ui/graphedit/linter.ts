/**
 * Semantic rule for GraphEdit: `zoom_min` authored above `zoom_max`.
 *
 * Advisory (WARNING, never error): each value on its own is a perfectly ordinary
 * float that Godot's parser reads, and neither validator can see the other. What
 * breaks is that the two SETTERS guard against each other:
 *
 *   void GraphEdit::set_zoom_min(float p_zoom_min) {
 *       ERR_FAIL_COND_MSG(p_zoom_min > zoom_max, "Cannot set min zoom level greater than max zoom level.");
 *   (scene/gui/graph_edit.cpp:2479-2480)
 *
 *   void GraphEdit::set_zoom_max(float p_zoom_max) {
 *       ERR_FAIL_COND_MSG(p_zoom_max < zoom_min, "Cannot set max zoom level lesser than min zoom level.");
 *   (scene/gui/graph_edit.cpp:2494-2495)
 *
 * Both orderings a text-resource loader could apply the pair in lose one of the
 * two writes. Applying `zoom_min` first: either it is already above the current
 * `zoom_max` and is refused outright, or it lands and the following
 * `set_zoom_max` sees `p_zoom_max < zoom_min` and is refused instead. Applying
 * `zoom_max` first is the mirror image. So at least one of the authored limits
 * never reaches the node, and the engine silently keeps a constructor default
 * (graph_edit.cpp:3175, 3177) in its place while the `.tscn` text goes on
 * showing both numbers.
 *
 * Scope, deliberately: this rule does NOT model `set_zoom`'s
 * `CLAMP(p_zoom, zoom_min, zoom_max)` (graph_edit.cpp:2434). That clamp runs
 * against whatever limits are installed at the moment the `zoom` write is
 * applied, so its outcome depends on the order the properties appear in the
 * file, and a rule that assumed one order would be wrong for the other.
 *
 * Format validation lives in linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';

function checkZoomLimits(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];

  const props = node.properties as Record<string, string>;
  const minRaw = props.zoom_min;
  const maxRaw = props.zoom_max;
  if (minRaw === undefined || maxRaw === undefined) return [];

  const min = parseFloat(minRaw);
  const max = parseFloat(maxRaw);
  if (isNaN(min) || isNaN(max)) return [];

  // Both guards fail on a STRICT comparison, so an equal pair is legal Godot:
  // a zoom range frozen at one level, but one the engine installs intact.
  if (min <= max) return [];

  return [
    {
      severity: 'warning',
      message: `GraphEdit 'zoom_min = ${minRaw}' is above 'zoom_max = ${maxRaw}'. set_zoom_min refuses a minimum above the current maximum and set_zoom_max refuses a maximum below the current minimum, so whichever the loader applies second is dropped and one of the two limits silently stays at its constructor default.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'graphedit-zoom-min-above-max',
    },
  ];
}

const graphEditZoomLimitsRule: LintRule = {
  meta: {
    name: 'valid-graphedit-zoom-limits',
    description:
      "Flags a GraphEdit whose zoom_min is authored above zoom_max, because Godot's two setters guard against each other, so one of the limits never lands",
    category: 'validation',
    applicableNodeTypes: ['GraphEdit'],
    emits: [{ ruleName: 'graphedit-zoom-min-above-max', severity: 'warning' }],
  },
  check: checkZoomLimits,
};

ruleRegistry.register(graphEditZoomLimitsRule);

export { graphEditZoomLimitsRule };
