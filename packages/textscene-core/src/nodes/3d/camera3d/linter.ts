/**
 * Semantic linter rules for Camera3D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { descendsFrom } from '../../../linter/nodeBaseTypes.js';
import { parseGodotFloat, ruleInt } from '../../../linter/validators/commonValidators.js';

/** `Camera3D::ProjectionType` (camera_3d.h:45-47). */
const PROJECTION_PERSPECTIVE = 0;
const PROJECTION_ORTHOGONAL = 1;
const PROJECTION_FRUSTUM = 2;

/** `Camera3D::_near` / `_far` defaults (camera_3d.h:72-73), omitted when serialised. */
const NEAR_DEFAULT = 0.05;
const FAR_DEFAULT = 4000.0;

/**
 * The mode `Camera3D::mode` actually holds after the key is applied.
 *
 * `set_projection` (camera_3d.cpp:341) assigns only for the three enum members,
 * so an out-of-enum value is dropped and the field keeps its camera_3d.h:66
 * default of `PROJECTION_PERSPECTIVE` — which is also what an absent key means,
 * since Godot omits a property at its default.
 */
function projectionMode(raw: string | undefined): number {
  const mode = raw === undefined ? null : ruleInt(raw);
  return mode === PROJECTION_ORTHOGONAL || mode === PROJECTION_FRUSTUM
    ? mode
    : PROJECTION_PERSPECTIVE;
}

/**
 * Validate Camera3D semantic rules
 */
function checkCamera3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;


  // Type guard for properties
  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

  // `fov` gets no presence check. Godot defaults it to 75 (camera_3d.h:68) and
  // omits defaults when serialising, and camera3d/parser.ts defaults it the
  // same way, so an absent key means 75 rather than missing.

  // The pair per PROJECTION MODE. `Camera3D::set_near`/`set_far`
  // (camera_3d.cpp:736, :746) are bare assignments and both hints end in
  // `or_greater` (camera_3d.cpp:685-686), so neither plane's own bound says
  // anything about the other; the tier comes entirely from which `Projection`
  // setter the mode reaches (camera_3d.cpp:272-282), and the three differ:
  //
  //   frustum      projection.cpp:367's `ERR_FAIL_COND(p_far <= p_near)`
  //                refuses outright, at BOTH `far < near` and `far == near`.
  //   perspective  projection.cpp:263 returns when `deltaZ == 0`, BEFORE the
  //                `set_identity()` at :268 — the whole write is dropped, and
  //                only at that one cell. `near > far` leaves deltaZ negative,
  //                so the matrix is written and depth is merely inverted.
  //   orthogonal   projection.cpp:344 has no guard: it divides by
  //                `zfar - znear` at :351 and stores inf. Nothing is refused,
  //                clamped or dropped, no hint end is crossed, and Camera3D
  //                declares no `get_configuration_warnings`, so ADR-0032
  //                licenses no tier at all and this reports nothing.
  //
  // An ABSENT plane is a defaulted one, not a missing one: Godot omits a
  // property sitting at its default, so the pair is still a pair and
  // `far = 0.05` alone is the same zero depth range as writing both.
  //
  // `parseGodotFloat`, not `parseFloat`: `inf` / `-inf` / `inf_neg` are float
  // literals Godot writes and reloads (variant_parser.cpp:150-155), and
  // `parseFloat` reads every one of them as NaN — which makes `far <= near`
  // false and silently skips the pair the ERR_FAIL_COND does refuse.
  const near = rawProps.near === undefined ? NEAR_DEFAULT : parseGodotFloat(rawProps.near);
  const far = rawProps.far === undefined ? FAR_DEFAULT : parseGodotFloat(rawProps.far);

  if (near !== null && far !== null) {
    const mode = projectionMode(rawProps.projection);
    // A `nan` plane needs no guard of its own: every comparison below is false
    // for it, exactly as the C++ ones are.
    if (mode === PROJECTION_FRUSTUM && far <= near) {
      diagnostics.push({
        severity: 'error',
        message: `Camera3D 'near' clipping plane (${near}) must be below 'far' (${far}). Under the frustum projection Godot refuses the pair outright when 'far' is not greater than 'near', so no projection is built from it.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'camera3d-invalid-clipping-planes',
      });
    }
    // `far - near`, not `near === far`: projection.cpp:260 forms deltaZ and
    // :263 tests it against zero, so two infinities give nan and do NOT return
    // early the way two equal finite planes do.
    if (mode === PROJECTION_PERSPECTIVE && far - near === 0) {
      diagnostics.push({
        severity: 'error',
        message: `Camera3D 'near' and 'far' clipping planes are both ${near}. Under the perspective projection Godot returns on the zero depth range before it writes the matrix, so the pair is dropped and no projection is built from it.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'camera3d-zero-depth-range',
      });
    }
  }

  return diagnostics;
}

/**
 * Camera3D semantic validation rule
 */
const camera3DValidationRule: LintRule = {
  meta: {
    name: 'valid-camera3d-properties',
    description:
      "Validates the Camera3D near/far clipping-plane pair per projection mode, which neither plane's own bound can express",
    category: 'validation',
    emits: [
      {
        ruleName: 'camera3d-invalid-clipping-planes',
        severity: 'error',
        // ERR_FAIL_COND(p_far <= p_near), reached only by the frustum mode.
        grounding: { kind: 'engine', at: 'projection.cpp:367' },
      },
      {
        ruleName: 'camera3d-zero-depth-range',
        severity: 'error',
        // The perspective early return on `deltaZ == 0`, before set_identity.
        grounding: { kind: 'engine', at: 'projection.cpp:263' },
      },
    ],
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'Camera3D'),
  },
  check: checkCamera3D,
};

// Self-register the rule
ruleRegistry.register(camera3DValidationRule);

// Export for testing
export { camera3DValidationRule };
