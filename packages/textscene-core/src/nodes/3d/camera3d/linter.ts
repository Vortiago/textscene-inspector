/**
 * Semantic linter rules for Camera3D: checks that need more than one property. linterParser.ts
 * validates format during strict parsing.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnNode } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties, nodesDescendingFrom } from '../../../linter/linterUtils.js';
import { viewportScopeCounter, viewportScopeOf } from '../../../linter/viewportScope.js';
import { descendsFrom } from '../../../godot/nodeBaseTypes.js';
import { parseGodotFloat, ruleInt } from '../../../linter/validators/commonValidators.js';
import { boolSlotValue } from '../../../godot/index.js';

/** `Camera3D::ProjectionType` (camera_3d.h:45-47). */
const PROJECTION_PERSPECTIVE = 0;
const PROJECTION_ORTHOGONAL = 1;
const PROJECTION_FRUSTUM = 2;

/** `Camera3D::_near` / `_far` defaults (camera_3d.h:72-73), omitted when serialised. */
const NEAR_DEFAULT = 0.05;
const FAR_DEFAULT = 4000.0;

/**
 * The mode `Camera3D::mode` holds after the key is applied. `set_projection` (camera_3d.cpp:341)
 * assigns only for the three enum members, so an out-of-enum value keeps the camera_3d.h:66
 * default of `PROJECTION_PERSPECTIVE`, which an absent key also means.
 */
function projectionMode(raw: string | undefined): number {
  const mode = ruleInt(raw, null);
  return mode === PROJECTION_ORTHOGONAL || mode === PROJECTION_FRUSTUM
    ? mode
    : PROJECTION_PERSPECTIVE;
}

/**
 * Whether this camera claims the viewport's current-camera slot. `current` defaults
 * false (camera_3d.h:63) and Camera3D has no `enabled`, so an authored true is the
 * only claim: a plain camera entering an empty viewport takes the slot as
 * first_camera (camera_3d.cpp:189-192) and cycling one in with `make_current()` is
 * documented usage. Unreadable properties state no claim.
 */
function cameraClaimsCurrent(node: TscnNode): boolean {
  if (!isValidProperties(node.properties)) return false;
  return boolSlotValue(node.properties.current) === true;
}

/**
 * Cameras claiming `current` that share `scope`'s viewport. The family joins, since
 * the slot set takes any Camera3D subclass: `XRCamera3D` inherits the ENTER_WORLD
 * handler that joins it (camera_3d.cpp:186). A type the catalog does not know joins
 * nothing here, the same no-guess rule as the scope walk.
 */
const countCurrentCamerasInScope = viewportScopeCounter((roots) =>
  nodesDescendingFrom(roots, 'Camera3D').filter(cameraClaimsCurrent)
);

function checkCamera3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;


  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

  // After the properties guard, unlike the Camera2D rule: here an unreadable body
  // states no claim, so it can neither contend for the slot nor join a tally.
  if (cameraClaimsCurrent(node)) {
    const scope = viewportScopeOf(scene, node);
    const claiming = scope === undefined ? 0 : countCurrentCamerasInScope(scene, scope);
    if (claiming > 1) {
      diagnostics.push({
        severity: 'info',
        message: `${node.type} 'current' contention: ${claiming} cameras claim the current-camera slot of one viewport. Only one holds it: the last one entered wins, and the others silently lose it (viewport.cpp:4578), so only one of them draws.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'camera3d-multiple-current',
      });
    }
  }

  // `fov` gets no presence check. Godot defaults it to 75 (camera_3d.h:68) and
  // omits defaults when serialising, and camera3d/parser.ts defaults it the
  // same way, so an absent key means 75 rather than missing.

  // `parseGodotFloat`, not `parseFloat`, which reads Godot's `inf` / `-inf` / `inf_neg` literals
  // (variant_parser.cpp:150-155) as NaN and skips the pair the ERR_FAIL_COND refuses. An absent
  // plane is defaulted, not missing, since Godot omits a property at its default, so `far = 0.05`
  // alone is the same zero depth range as writing both.
  const near = rawProps.near === undefined ? NEAR_DEFAULT : parseGodotFloat(rawProps.near);
  const far = rawProps.far === undefined ? FAR_DEFAULT : parseGodotFloat(rawProps.far);

  // set_near/set_far (camera_3d.cpp:736, :746) are bare assignments and both hints end in
  // `or_greater` (camera_3d.cpp:685-686), so the pair's tier comes from the `Projection` setter
  // each mode reaches (camera_3d.cpp:272-282).
  if (near !== null && far !== null) {
    const mode = projectionMode(rawProps.projection);
    // Frustum: projection.cpp:367's `ERR_FAIL_COND(p_far <= p_near)` refuses both `far < near`
    // and `far == near`. A `nan` plane needs no guard: every comparison below is false for it,
    // as the C++ ones are.
    if (mode === PROJECTION_FRUSTUM && far <= near) {
      diagnostics.push({
        severity: 'error',
        message: `Camera3D 'near' clipping plane (${near}) must be below 'far' (${far}). Under the frustum projection Godot refuses the pair outright when 'far' is not greater than 'near', so no projection is built from it.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'camera3d-invalid-clipping-planes',
      });
    }
    // Perspective: projection.cpp:263 returns when deltaZ (`far - near`, projection.cpp:260) is
    // zero, before `set_identity()` at :268. Not `near === far`: two infinities give nan and do
    // not return early. `near > far` leaves deltaZ negative, so the matrix is written with depth
    // inverted.
    if (mode === PROJECTION_PERSPECTIVE && far - near === 0) {
      diagnostics.push({
        severity: 'warning',
        message: `Camera3D 'near' and 'far' clipping planes are both ${near}. Under the perspective projection Godot returns on the zero depth range before it writes the matrix, so the pair is dropped and no projection is built from it.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'camera3d-zero-depth-range',
      });
    }
    // Orthogonal: projection.cpp:344 has no guard and divides by `zfar - znear` at :351, storing
    // inf. Nothing is refused, clamped or dropped, no hint end is crossed, and Camera3D declares
    // no `get_configuration_warnings`, so ADR-0032 licenses no tier and this reports nothing.
  }

  return diagnostics;
}

const camera3DValidationRule: LintRule = {
  meta: {
    name: 'valid-camera3d-properties',
    description:
      "Validates the Camera3D near/far clipping-plane pair per projection mode, which neither plane's own bound can express, and reports cameras that contend for one viewport's current-camera slot",
    category: 'validation',
    emits: [
      {
        ruleName: 'camera3d-multiple-current',
        severity: 'info',
        grounding: {
          kind: 'engine-inert',
          at: 'camera_3d.cpp:190',
          unused: 'the earlier camera loses the slot to the last entered current one and is never drawn',
        },
      },
      {
        ruleName: 'camera3d-invalid-clipping-planes',
        severity: 'error',
        // ERR_FAIL_COND(p_far <= p_near), reached only by the frustum mode.
        grounding: { kind: 'engine', at: 'projection.cpp:367' },
      },
      {
        ruleName: 'camera3d-zero-depth-range',
        severity: 'warning',
        // The perspective early return on `deltaZ == 0` drops the write in silence and leaves
        // both properties stored: a 4.6.3 render prints nothing, where the frustum pair prints
        // `Condition "p_far <= p_near" is true` once per frame. Neither error form applies.
        grounding: { kind: 'engine', at: 'projection.cpp:263' },
      },
    ],
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'Camera3D'),
  },
  check: checkCamera3D,
};

ruleRegistry.register(camera3DValidationRule);

// Export for testing
export { camera3DValidationRule };
