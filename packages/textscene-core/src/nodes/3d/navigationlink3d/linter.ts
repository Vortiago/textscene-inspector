/**
 * Semantic linter rule for NavigationLink3D — Godot's own configuration
 * warning, `get_configuration_warnings()` (navigation_link_3d.cpp:494-502):
 *
 *     PackedStringArray NavigationLink3D::get_configuration_warnings() const {
 *         PackedStringArray warnings = Node3D::get_configuration_warnings();
 *         if (start_position.is_equal_approx(end_position)) {
 *             warnings.push_back(RTR("NavigationLink3D start position should be
 *             different than the end position to be useful."));
 *         }
 *         return warnings;
 *     }
 *
 * Not cosmetic: a link whose two ends coincide still creates a real
 * NavigationServer3D link (the constructor and `_link_enter_navigation_map`
 * run regardless of the two positions), just one with zero length, so
 * pathfinding gains a connection that goes nowhere. Godot's own severity for
 * this is a configuration warning, not a load refusal, so this rule is
 * WARNING tier, matching it exactly.
 *
 * The comparison is UNGATED: no presence check, no `_validate_property`, no
 * `ADD_PROPERTY_DEFAULT`, and the constructor (:274-285) never touches either
 * field. `start_position`/`end_position` are declared with no initializer
 * (navigation_link_3d.h:43-44), so a `Vector3` that a `.tscn` never sets
 * zero-constructs exactly like one authored as `Vector3(0, 0, 0)` — by the
 * time this method runs, the two are indistinguishable. This rule mirrors
 * that: it resolves each side to its documented default, `Vector3(0, 0, 0)`
 * (doc/classes/NavigationLink3D.xml), when the key is absent, then always
 * runs the comparison — including on a bare node with NEITHER key written,
 * which is exactly what a freshly-added NavigationLink3D looks like, and
 * exactly what the Godot editor's warning triangle flags on it before its
 * endpoints are dragged apart.
 *
 * This does not conflict with "absence is Godot's default form": that
 * convention forbids treating an absent key as an AUTHORED value or
 * requiring one to be present. This rule does neither — it fills absence
 * with the class default and applies the engine's own check to the resolved
 * value, the same substitution the engine performs internally. (This is a
 * narrower case than SpringBoneCollisionCapsule3D's cross-field rule, which
 * legitimately gates on both keys being written: that invariant lives in the
 * SETTERS, which only run for a key the file actually assigns, so presence
 * is load-bearing there. `get_configuration_warnings` here reads only the
 * final resolved members and does not care how they got that value.)
 *
 * `Vector3::is_equal_approx` (core/math/vector3.cpp:141-143) is
 * per-COMPONENT `Math::is_equal_approx`, which `godot/math.ts` provides — the
 * asymmetric, left-scaled tolerance is documented there.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { VECTOR3_REGEX } from '../../../linter/validators/vectorValidators.js';
import { tupleComponent } from '../../../linter/validators/commonValidators.js';
import { isEqualApprox } from '../../../godot/index.js';
import type { Vector3 } from '../../../parser/vectors.js';

/** navigation_link_3d.h:43-44 declares both fields with no initializer; doc/classes/NavigationLink3D.xml:81,92 confirms the resulting zero-construct as the documented default. */
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
      { ruleName: 'navigationlink3d-start-position-equals-end-position', severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkNavigationLink3D,
};

ruleRegistry.register(navigationLink3DPositionRule);

export { navigationLink3DPositionRule };
