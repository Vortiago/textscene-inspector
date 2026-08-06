/**
 * Semantic linter rule for NavigationLink2D — Godot's own configuration
 * warning, `NavigationLink2D::get_configuration_warnings()`
 * (navigation_link_2d.cpp:331-338):
 *
 *     if (start_position.is_equal_approx(end_position)) {
 *         warnings.push_back(RTR("NavigationLink2D start position should be
 *         different than the end position to be useful."));
 *     }
 *
 * `start_position` and `end_position` both default to `Vector2(0, 0)`
 * (doc/classes/NavigationLink2D.xml), and Godot's serializer omits a property
 * left at its default — "absence is Godot's default form", so a scene never
 * has to spell out the default just to stay quiet. This rule therefore only
 * fires when BOTH keys are textually present in the `.tscn` AND they resolve
 * to the same point: an omitted key never counts as an authored `(0, 0)`, the
 * same gate `Window`'s `max_size`/`min_size` rule uses for the identical
 * reason. A key present but malformed is left alone too:
 * `linterParser.ts`'s format validator already reports it, one diagnostic per
 * bad value rather than two.
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
import { makeFloatTupleRegex, tupleComponent } from '../../../linter/validators/index.js';
import { isEqualApprox } from '../../../godot/index.js';

const RULE_NAME = 'navigationlink2d-coincident-endpoints';

const VECTOR2_REGEX = makeFloatTupleRegex('Vector2', 2);

interface Vec2 {
  x: number;
  y: number;
}

/** `null` for a present-but-malformed value, so the caller can stay quiet and leave the format error to `linterParser.ts`. */
function parseVector2Literal(raw: string): Vec2 | null {
  const match = VECTOR2_REGEX.exec(raw);
  if (!match) return null;
  return { x: tupleComponent(match[1]), y: tupleComponent(match[2]) };
}

/** core/math/vector2.cpp:193-195, Vector2::is_equal_approx: per-component, left-scaled tolerance. */
function isEqualApproxVector2(left: Vec2, right: Vec2): boolean {
  return isEqualApprox(left.x, right.x) && isEqualApprox(left.y, right.y);
}

function checkNavigationLink2D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];
  const rawProps = node.properties as Record<string, string>;

  // Godot's serializer omits either key at its Vector2(0, 0) default, so
  // "absent" must NOT read as an authored zero — only an explicit pair of
  // keys can trip this, mirroring Window's max_size/min_size gate.
  if (rawProps.start_position === undefined || rawProps.end_position === undefined) return [];

  const start = parseVector2Literal(rawProps.start_position);
  const end = parseVector2Literal(rawProps.end_position);
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
      'Warns when an explicit NavigationLink2D start_position and end_position coincide, so the link routes nowhere',
    category: 'validation',
    applicableNodeTypes: ['NavigationLink2D'],
    emits: [{ ruleName: RULE_NAME, severity: 'warning' }],
  },
  check: checkNavigationLink2D,
};

ruleRegistry.register(navigationLink2DEndpointsRule);

export { navigationLink2DEndpointsRule };
