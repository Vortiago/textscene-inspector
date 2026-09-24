/**
 * Ports NavigationLink2D::get_configuration_warnings() (navigation_link_2d.cpp:331-339),
 * which warns when `start_position.is_equal_approx(end_position)`. The check is
 * ungated and the constructor (:427-439) sets neither field, so a bare node warns.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { VECTOR2_REGEX, tupleComponent } from '../../../linter/validators/index.js';
import { slotComponents, slotComponentsAltered } from '../../../godot/int.js';
import { isEqualApprox } from '../../../godot/index.js';

const RULE_NAME = 'navigationlink2d-coincident-endpoints';

interface Vec2 {
  x: number;
  y: number;
}

/**
 * navigation_link_2d.h:43-44 declares both fields with no initializer, and
 * doc/classes/NavigationLink2D.xml:81,92 documents the zero default. An absent
 * key takes it, as in the engine: this reads absence as the default and never
 * requires the key.
 */
const DEFAULT_POSITION: Vec2 = { x: 0, y: 0 };

/** `null` for a present-but-malformed value, so the caller can stay quiet and leave the format error to `linterParser.ts`. */
function parseVector2Literal(raw: string): Vec2 | null {
  const trimmed = raw.trim();
  const match = VECTOR2_REGEX.exec(trimmed);
  if (!match) return null;
  const captures = [match[1], match[2]];
  // Withheld, not NaN: the engine stores a number here, but not the one
  // written, and `_to_int`'s float branch is undefined behaviour
  // (variant.h:369-370), so this rule cannot name it.
  if (slotComponentsAltered(trimmed, 'Vector2', captures)) return null;
  // `slotComponents`: VECTOR2_REGEX admits the `Vector2i(...)` spelling Godot
  // converts, whose arguments are narrowed to int32 before the widening.
  const [x, y] = slotComponents(trimmed, 'Vector2', captures, tupleComponent);
  return { x: x!, y: y! };
}

/** The `Vector2(x, y)` a property carries, its documented default when absent, or null when malformed. */
function readPosition(properties: Record<string, string>, key: string): Vec2 | null {
  const raw = properties[key];
  if (raw === undefined) return DEFAULT_POSITION;
  return parseVector2Literal(raw);
}

/**
 * core/math/vector2.cpp:193-195, Vector2::is_equal_approx: per component, with a
 * tolerance scaled by the left operand, so `start_position` goes first.
 */
function isEqualApproxVector2(left: Vec2, right: Vec2): boolean {
  return isEqualApprox(left.x, right.x) && isEqualApprox(left.y, right.y);
}

function checkNavigationLink2D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const properties = isValidProperties(node.properties)
    ? (node.properties as Record<string, string>)
    : {};

  const start = readPosition(properties, 'start_position');
  const end = readPosition(properties, 'end_position');
  // A malformed literal is the format validator's finding, not this rule's;
  // it stays silent rather than double-reporting or guessing a comparison.
  if (!start || !end) return [];
  if (!isEqualApproxVector2(start, end)) return [];

  return [
    {
      severity: 'warning',
      message: `NavigationLink2D '${node.name}' has start_position and end_position at the same point (Vector2(${start.x}, ${start.y})), so it routes nowhere. Godot's own configuration warning: "NavigationLink2D start position should be different than the end position to be useful."`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: RULE_NAME,
    },
  ];
}

const navigationLink2DEndpointsRule: LintRule = {
  meta: {
    name: 'valid-navigationlink2d-endpoints',
    description:
      'Warns when NavigationLink2D start_position and end_position resolve to the same point (each defaulting to Vector2(0, 0) when omitted), so the link routes nowhere',
    category: 'validation',
    applicableNodeTypes: ['NavigationLink2D'],
    emits: [{ ruleName: RULE_NAME, severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkNavigationLink2D,
};

ruleRegistry.register(navigationLink2DEndpointsRule);

export { navigationLink2DEndpointsRule };
