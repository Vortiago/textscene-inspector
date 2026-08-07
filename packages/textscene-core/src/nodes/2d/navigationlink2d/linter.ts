/**
 * Semantic linter rule for NavigationLink2D — Godot's own configuration
 * warning, `NavigationLink2D::get_configuration_warnings()`
 * (navigation_link_2d.cpp:331-339):
 *
 *     PackedStringArray NavigationLink2D::get_configuration_warnings() const {
 *         PackedStringArray warnings = Node2D::get_configuration_warnings();
 *         if (start_position.is_equal_approx(end_position)) {
 *             warnings.push_back(RTR("NavigationLink2D start position should be
 *             different than the end position to be useful."));
 *         }
 *         return warnings;
 *     }
 *
 * The comparison is UNGATED: no presence check, no `_validate_property`, no
 * `ADD_PROPERTY_DEFAULT`, and the constructor (:427-439) never touches either
 * field. `start_position`/`end_position` are declared with no initializer
 * (navigation_link_2d.h:43-44), so a `Vector2` that a `.tscn` never sets
 * zero-constructs exactly like one that was authored as `Vector2(0, 0)` —
 * by the time this method runs, the two are indistinguishable. This rule
 * mirrors that: it resolves each side to its documented default,
 * `Vector2(0, 0)` (doc/classes/NavigationLink2D.xml), when the key is
 * absent, then always runs the comparison — including on a bare node with
 * NEITHER key written, which is exactly what a freshly-added
 * NavigationLink2D looks like, and exactly what the Godot editor's warning
 * triangle flags on it before its endpoints are dragged apart.
 *
 * This does not conflict with "absence is Godot's default form": that
 * convention forbids treating an absent key as an AUTHORED value or
 * requiring one to be present. This rule does neither — it fills absence
 * with the class default and applies the engine's own check to the
 * resolved value, the same substitution the engine performs internally.
 * A key present but malformed is left alone: `linterParser.ts`'s format
 * validator already reports it, one diagnostic per bad value rather than
 * two.
 *
 * `Vector2::is_equal_approx` (core/math/vector2.cpp:193-195) delegates
 * per-component to `Math::is_equal_approx`, which `godot/math.ts` provides. Its
 * tolerance scales with the magnitude of the LEFT operand, so the operands are
 * passed receiver-first — `start_position`'s component, then `end_position`'s —
 * to match what the engine compares.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { VECTOR2_REGEX, tupleComponent } from '../../../linter/validators/index.js';
import { isEqualApprox } from '../../../godot/index.js';

const RULE_NAME = 'navigationlink2d-coincident-endpoints';


interface Vec2 {
  x: number;
  y: number;
}

/** navigation_link_2d.h:43-44 declares both fields with no initializer; doc/classes/NavigationLink2D.xml:81,92 confirms the resulting zero-construct as the documented default. */
const DEFAULT_POSITION: Vec2 = { x: 0, y: 0 };

/** `null` for a present-but-malformed value, so the caller can stay quiet and leave the format error to `linterParser.ts`. */
function parseVector2Literal(raw: string): Vec2 | null {
  const match = VECTOR2_REGEX.exec(raw.trim());
  if (!match) return null;
  return { x: tupleComponent(match[1]), y: tupleComponent(match[2]) };
}

/** The `Vector2(x, y)` a property carries, its documented default when absent, or null when malformed. */
function readPosition(properties: Record<string, string>, key: string): Vec2 | null {
  const raw = properties[key];
  if (raw === undefined) return DEFAULT_POSITION;
  return parseVector2Literal(raw);
}

/** core/math/vector2.cpp:193-195, Vector2::is_equal_approx: per-component, left-scaled tolerance. */
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
    emits: [{ ruleName: RULE_NAME, severity: 'warning' }],
  },
  check: checkNavigationLink2D,
};

ruleRegistry.register(navigationLink2DEndpointsRule);

export { navigationLink2DEndpointsRule };
