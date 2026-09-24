/**
 * NavigationLink3D's configuration warning (navigation_link_3d.cpp:494-502) for
 * a start and end position that are approximately equal. Such a link still
 * creates a zero-length NavigationServer3D link, and Godot only warns, so this
 * rule warns. An absent position is the doc/classes/NavigationLink3D.xml default.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { VECTOR3_REGEX } from '../../../linter/validators/vectorValidators.js';
import { tupleComponent } from '../../../linter/validators/commonValidators.js';
import { slotComponents, slotComponentsAltered } from '../../../godot/int.js';
import { isEqualApprox } from '../../../godot/index.js';
import type { Vector3 } from '../../../parser/vectors.js';

/**
 * navigation_link_3d.h:43-44 declares both fields with no initializer, and the constructor
 * (:274-285) never sets them, so an absent key equals `Vector3(0, 0, 0)`
 * (doc/classes/NavigationLink3D.xml:81,92). The comparison runs even on a bare node, as the
 * engine's does: filling absence with the class default authors nothing.
 */
const DEFAULT_POSITION: Vector3 = { x: 0, y: 0, z: 0 };

/** The `Vector3(x, y, z)` a property carries, its XML default when absent, or null when malformed. */
function readPosition(properties: Record<string, string>, key: string): Vector3 | null {
  const raw = properties[key];
  if (raw === undefined) return DEFAULT_POSITION;
  const trimmed = raw.trim();
  const match = VECTOR3_REGEX.exec(trimmed);
  if (!match) return null;
  const captures = [match[1], match[2], match[3]];
  // Withheld, not NaN: the engine stores a number, but not the one written, and
  // `_to_int`'s float branch is undefined behaviour (variant.h:369-370).
  if (slotComponentsAltered(trimmed, 'Vector3', captures)) return null;
  // `slotComponents`: VECTOR3_REGEX admits the `Vector3i(...)` spelling Godot
  // converts, whose arguments are narrowed to int32 before the widening.
  const [x, y, z] = slotComponents(trimmed, 'Vector3', captures, tupleComponent);
  return { x: x!, y: y!, z: z! };
}

/** `Vector3::is_equal_approx` (core/math/vector3.cpp:141-143): each component by `isEqualApprox`. */
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
  // A malformed literal is the format validator's finding, so this rule stays silent.
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
