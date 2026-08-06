/**
 * Semantic linter rule for NavigationLink3D — Godot's own configuration
 * warning, `get_configuration_warnings()` (navigation_link_3d.cpp:493-499):
 *
 *     if (start_position.is_equal_approx(end_position)) {
 *         warnings.push_back(RTR("NavigationLink3D start position should be
 *         different than the end position to be useful."));
 *     }
 *
 * Not cosmetic: a link whose two ends coincide still creates a real
 * NavigationServer3D link (the constructor and `_link_enter_navigation_map`
 * run regardless of the two positions), just one with zero length, so
 * pathfinding gains a connection that goes nowhere. Godot's own severity for
 * this is a configuration warning, not a load refusal, so this rule is
 * WARNING tier, matching it exactly.
 *
 * `Vector3::is_equal_approx` (core/math/vector3.cpp:141-143) is
 * per-COMPONENT `Math::is_equal_approx`, which `godot/math.ts` provides — the
 * asymmetric, left-scaled tolerance is documented there.
 *
 * Both properties default to `Vector3(0, 0, 0)` when the `.tscn` omits them
 * (doc/classes/NavigationLink3D.xml). This rule only fires once at least ONE
 * of the two is actually written: with BOTH absent there is nothing authored
 * to contradict, and per this project's convention the serializer's own
 * defaults are never a lint defect — the same call SpringBoneCollisionCapsule3D
 * makes ("stays quiet on a capsule with no properties at all") for its own
 * cross-field rule. But once either key IS written, Godot's own
 * `get_configuration_warnings` still runs against the true default for
 * whichever side stayed unset, so a single written value landing on the
 * other's shared zero default is exactly the case Godot's editor flags, and
 * this rule agrees.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { VECTOR3_REGEX } from '../../../linter/validators/vectorValidators.js';
import { tupleComponent } from '../../../linter/validators/commonValidators.js';
import { isEqualApprox } from '../../../godot/index.js';
import type { Vector3 } from '../../../parser/vectors.js';

/** doc/classes/NavigationLink3D.xml: both positions default to Vector3(0, 0, 0). */
const DEFAULT_POSITION: Vector3 = { x: 0, y: 0, z: 0 };

/** The `Vector3(x, y, z)` a property carries, its XML default when absent, or null when malformed. */
function readPosition(properties: Record<string, string>, key: string): Vector3 | null {
  const raw = properties[key];
  if (raw === undefined) return DEFAULT_POSITION;
  const match = VECTOR3_REGEX.exec(raw.trim());
  if (!match) return null;
  return {
    x: tupleComponent(match[1]),
    y: tupleComponent(match[2]),
    z: tupleComponent(match[3]),
  };
}

/** `Vector3::is_equal_approx` — all three components, each by `isEqualApprox`. */
function vector3EqualApprox(a: Vector3, b: Vector3): boolean {
  return isEqualApprox(a.x, b.x) && isEqualApprox(a.y, b.y) && isEqualApprox(a.z, b.z);
}

function checkNavigationLink3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const properties = isValidProperties(node.properties)
    ? (node.properties as Record<string, string>)
    : {};

  // Absence is Godot's default form: a link that writes NEITHER position has
  // authored nothing to contradict.
  if (properties.start_position === undefined && properties.end_position === undefined) {
    return [];
  }

  const start = readPosition(properties, 'start_position');
  const end = readPosition(properties, 'end_position');
  // A malformed literal is the format validator's finding, not this rule's;
  // it stays silent rather than double-reporting or guessing a comparison.
  if (start === null || end === null) return [];
  if (!vector3EqualApprox(start, end)) return [];

  return [
    {
      severity: 'warning',
      message: `NavigationLink3D '${node.name}' has 'start_position' and 'end_position' at the same point. Godot's own editor flags this: a link needs its two ends apart to route anything through.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'navigationlink3d-start-position-equals-end-position',
    },
  ];
}

const navigationLink3DPositionRule: LintRule = {
  meta: {
    name: 'valid-navigationlink3d-positions',
    description:
      "Warns when a NavigationLink3D's start_position and end_position are the same point, which Godot's own editor also flags",
    category: 'validation',
    applicableNodeTypes: ['NavigationLink3D'],
    emits: [
      { ruleName: 'navigationlink3d-start-position-equals-end-position', severity: 'warning' },
    ],
  },
  check: checkNavigationLink3D,
};

ruleRegistry.register(navigationLink3DPositionRule);

export { navigationLink3DPositionRule };
