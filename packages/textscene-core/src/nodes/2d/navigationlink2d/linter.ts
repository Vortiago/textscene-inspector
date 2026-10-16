/**
 * Ports NavigationLink2D::get_configuration_warnings() (navigation_link_2d.cpp:331-339),
 * which warns when `start_position.is_equal_approx(end_position)`. The check is
 * ungated and the constructor (:427-439) sets neither field, so a bare node warns.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { armDiagnostic, armEmits, groundedArm, type RuleArms } from '../../../linter/ruleArms.js';
import { matchVector2 } from '../../../linter/validators/index.js';
import { isEqualApprox } from '../../../godot/math/math.js';
import type { Vector2 } from '../../../godot/math/vector.js';

const arms = {
  coincidentEndpoints: groundedArm('navigationlink2d-coincident-endpoints', {
    kind: 'configuration-warning',
  }),
} as const satisfies RuleArms<string>;

/**
 * navigation_link_2d.h:43-44 declares both fields with no initializer, and
 * doc/classes/NavigationLink2D.xml:81,92 documents the zero default. An absent
 * key takes it, as in the engine: this reads absence as the default and never
 * requires the key.
 */
const DEFAULT_POSITION: Vector2 = { x: 0, y: 0 };

/**
 * The `Vector2(x, y)` a property carries, its documented default when absent, or null when
 * malformed or when a component narrows to a number the file does not state.
 */
function readPosition(properties: Record<string, string>, key: string): Vector2 | null {
  const raw = properties[key];
  if (raw === undefined) return DEFAULT_POSITION;
  return matchVector2(raw);
}

/**
 * core/math/vector2.cpp:193-195, Vector2::is_equal_approx: per component, with a
 * tolerance scaled by the left operand, so `start_position` goes first.
 */
function isEqualApproxVector2(left: Vector2, right: Vector2): boolean {
  return isEqualApprox(left.x, right.x) && isEqualApprox(left.y, right.y);
}

function checkNavigationLink2D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const properties = node.rawProperties;

  const start = readPosition(properties, 'start_position');
  const end = readPosition(properties, 'end_position');
  // A malformed literal is the format validator's finding, not this rule's;
  // it stays silent rather than double-reporting or guessing a comparison.
  if (!start || !end) return [];
  if (!isEqualApproxVector2(start, end)) return [];

  return [
    armDiagnostic(
      arms.coincidentEndpoints,
      node,
      `NavigationLink2D '${node.name}' has start_position and end_position at the same point (Vector2(${start.x}, ${start.y})), so it routes nowhere. Godot's own configuration warning: "NavigationLink2D start position should be different than the end position to be useful."`
    ),
  ];
}

const navigationLink2DEndpointsRule: LintRule = {
  meta: {
    name: 'valid-navigationlink2d-endpoints',
    description:
      'Warns when NavigationLink2D start_position and end_position resolve to the same point (each defaulting to Vector2(0, 0) when omitted), so the link routes nowhere',
    category: 'validation',
    applicableNodeTypes: ['NavigationLink2D'],
    emits: armEmits(arms),
  },
  check: checkNavigationLink2D,
};

ruleRegistry.register(navigationLink2DEndpointsRule);
