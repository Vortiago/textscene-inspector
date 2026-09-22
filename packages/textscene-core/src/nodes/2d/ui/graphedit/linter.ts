/**
 * Semantic rules for GraphEdit: an inverted zoom-limit pair, and a
 * `scroll_offset` the load clamps away.
 *
 * ## `zoom_min` authored above `zoom_max`
 *
 * Error tier (ADR-0032): each value on its own is a perfectly ordinary float
 * that Godot's parser reads, and neither validator can see the other, but the
 * two SETTERS refuse each other outright:
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
 * ## `scroll_offset` discarded at load
 *
 * `engine-inert` (ADR-0032), so info. The property is `PROPERTY_HINT_NONE` with
 * no bound at either end (graph_edit.cpp:3069) and `set_scroll_offset` refuses
 * nothing. What makes the authored value inert is what the clamp at
 * graph_edit.cpp:407 READS: `min_scroll_offset`/`max_scroll_offset`, two
 * members only `_update_scrollbars` writes and which a load leaves measuring
 * an empty child list. That is stale load state rather than a bound on this
 * property, which is why the error and warning tiers do not reach it.
 *
 * `loadOrder.ts` replays the clamp — the renderer's own model of it, so the
 * diagnostic and the picture cannot disagree — and the rule reports whenever
 * what it returns differs from what the file wrote. The case worth naming is
 * `Vector2(0, 0)`: writing the default explicitly stores `-size`, while
 * omitting the line leaves the offset at `(0, 0)`.
 *
 * Format validation lives in linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { parseGodotFloat } from '../../../../linter/validators/commonValidators.js';
import { parseOptionalVector2 } from '../../../../parser/valueParsers.js';
import { resolveGraphEditLoadState } from './loadOrder.js';

function checkZoomLimits(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];

  const props = node.properties as Record<string, string>;
  const minRaw = props.zoom_min;
  const maxRaw = props.zoom_max;
  if (minRaw === undefined || maxRaw === undefined) return [];

  const min = parseGodotFloat(minRaw);
  const max = parseGodotFloat(maxRaw);
  // `nan` is excluded explicitly rather than left to the comparison: neither
  // ERR_FAIL_COND at graph_edit.cpp:2480/2495 trips on it, so a nan pair is
  // installed intact and there is no dropped limit to report.
  if (min === null || max === null || Number.isNaN(min) || Number.isNaN(max)) return [];

  // Both guards fail on a STRICT comparison, so an equal pair is legal Godot:
  // a zoom range frozen at one level, but one the engine installs intact.
  if (min <= max) return [];

  return [
    {
      severity: 'error',
      message: `GraphEdit 'zoom_min = ${minRaw}' is above 'zoom_max = ${maxRaw}'. set_zoom_min refuses a minimum above the current maximum and set_zoom_max refuses a maximum below the current minimum, so whichever the loader applies second is dropped and one of the two limits silently stays at its constructor default.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'graphedit-zoom-min-above-max',
    },
  ];
}

/** `Vector2(x, y)`, the spelling a `.tscn` would carry. */
function vector2Literal(value: { x: number; y: number }): string {
  return `Vector2(${value.x}, ${value.y})`;
}

function checkScrollOffset(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];

  const props = node.properties as Record<string, string>;
  const raw = props.scroll_offset;
  if (raw === undefined) return [];

  // The decoder the replay itself reads the key with, so a spelling either one
  // refuses leaves both with nothing and this rule silent; judging the literal
  // is the validator's job.
  const authored = parseOptionalVector2(raw);
  const stored = resolveGraphEditLoadState(props).scrollOffset;
  if (!authored || !stored) return [];
  if (stored.x === authored.x && stored.y === authored.y) return [];

  const explicitDefault =
    authored.x === 0 && authored.y === 0
      ? ' Omitting the property is what leaves the offset at (0, 0); writing it explicitly does not.'
      : '';

  return [
    {
      severity: 'info',
      message:
        `GraphEdit 'scroll_offset = ${raw}' does not survive the load: set_scroll_offset clamps it against ` +
        `min_scroll_offset and max_scroll_offset, which no laid-out child has widened yet, so Godot stores ` +
        `${vector2Literal(stored)} instead.${explicitDefault}`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'graphedit-scroll-offset-discarded',
    },
  ];
}

const graphEditPropertiesRule: LintRule = {
  meta: {
    name: 'valid-graphedit-properties',
    description:
      'Validates GraphEdit zoom-limit ordering and reports a scroll_offset the load clamps away',
    category: 'validation',
    applicableNodeTypes: ['GraphEdit'],
    emits: [
      {
        ruleName: 'graphedit-zoom-min-above-max',
        severity: 'error',
        grounding: { kind: 'engine', at: 'graph_edit.cpp:2480' },
      },
      {
        ruleName: 'graphedit-scroll-offset-discarded',
        severity: 'info',
        grounding: {
          kind: 'engine-inert',
          at: 'graph_edit.cpp:407',
          unused: 'the authored offset never becomes the stored scroll position',
        },
      },
    ],
  },
  check: (context) => [...checkZoomLimits(context), ...checkScrollOffset(context)],
};

ruleRegistry.register(graphEditPropertiesRule);

export { graphEditPropertiesRule };
