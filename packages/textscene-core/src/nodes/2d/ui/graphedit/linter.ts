/**
 * Semantic rules for GraphEdit: an inverted zoom-limit pair, and a `scroll_offset`
 * the load clamps away. linterParser.ts holds the format validators.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { parseGodotFloat } from '../../../../linter/validators/commonValidators.js';
import { parseOptionalVector2 } from '../../../../parser/valueParsers.js';
import { resolveGraphEditLoadState } from './loadOrder.js';

/**
 * Error tier (ADR-0032): `set_zoom_min` refuses `p_zoom_min > zoom_max` (scene/gui/graph_edit.cpp:2479-2480)
 * and `set_zoom_max` refuses `p_zoom_max < zoom_min` (scene/gui/graph_edit.cpp:2494-2495). In either load
 * order one write is dropped, and that limit keeps its constructor default (graph_edit.cpp:3175, 3177).
 */
function checkZoomLimits(context: RuleContext): Diagnostic[] {
  // The `CLAMP(p_zoom, zoom_min, zoom_max)` of `set_zoom` (graph_edit.cpp:2434) is left out: its
  // result depends on the file order of the keys.
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];

  const props = node.properties as Record<string, string>;
  const minRaw = props.zoom_min;
  const maxRaw = props.zoom_max;
  if (minRaw === undefined || maxRaw === undefined) return [];

  const min = parseGodotFloat(minRaw);
  const max = parseGodotFloat(maxRaw);
  // `nan` trips neither ERR_FAIL_COND (graph_edit.cpp:2480/2495), so a nan pair is
  // installed intact and no limit is dropped.
  if (min === null || max === null || Number.isNaN(min) || Number.isNaN(max)) return [];

  // Both guards compare strictly, so an equal pair installs intact: a zoom range frozen at one level.
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

/**
 * `engine-inert` (ADR-0032), so info. `scroll_offset` is `PROPERTY_HINT_NONE` (graph_edit.cpp:3069),
 * but the clamp at graph_edit.cpp:407 reads `min_scroll_offset` and `max_scroll_offset`, which only
 * `_update_scrollbars` writes and a load leaves unset. `loadOrder.ts` replays the clamp for the
 * renderer too. An explicit `Vector2(0, 0)` stores `-size`, and an omitted line keeps `(0, 0)`.
 */
function checkScrollOffset(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];

  const props = node.properties as Record<string, string>;
  const raw = props.scroll_offset;
  if (raw === undefined) return [];

  // The decoder the replay reads the key with, so a spelling it refuses leaves this rule
  // silent. Judging the literal is the validator's job.
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
