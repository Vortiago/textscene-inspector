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
import { parseGodotFloat } from '../../../linter/validators/commonValidators.js';

/** `Camera3D::PROJECTION_FRUSTUM` (camera_3d.h:47), the third of three. */
const PROJECTION_FRUSTUM = 2;

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

  // ERROR: the projection the pair produces, per mode.
  //
  // `Camera3D::set_near`/`set_far` (camera_3d.cpp:737, :747) assign straight
  // through, so the tier comes from what `_update_camera_mode`
  // (camera_3d.cpp:102-115) then hands the pair to, and the three modes differ:
  //
  //   near == far — no mode survives it. `set_perspective` returns at
  //     projection.cpp:263, BEFORE the `set_identity()` on the next line, so the
  //     whole write is dropped and the camera keeps a default identity
  //     projection. `set_orthogonal` has no guard at all and divides by
  //     `zfar - znear` at projection.cpp:351, storing inf (NaN when both are 0).
  //     `set_frustum` refuses outright.
  //   near > far — only frustum refuses, at projection.cpp:367's
  //     `ERR_FAIL_COND(p_far <= p_near)`. Elsewhere deltaZ is merely negative,
  //     the matrix is written, and depth is inverted but finite.
  //
  // Both hints end in `or_greater` (camera_3d.cpp:685-686), so neither end
  // constrains the pair and there is no warning tier to fall back to.
  if (rawProps.near !== undefined && rawProps.far !== undefined) {
    // `parseGodotFloat`, not `parseFloat`: `inf` / `-inf` / `inf_neg` are float
    // literals Godot writes and reloads (variant_parser.cpp:150-155), and
    // `parseFloat` reads every one of them as NaN — which makes `near >= far`
    // false and silently skips the pair the ERR_FAIL_COND does refuse.
    const near = parseGodotFloat(rawProps.near);
    const far = parseGodotFloat(rawProps.far);
    const frustum = parseInt(rawProps.projection ?? '', 10) === PROJECTION_FRUSTUM;

    if (near !== null && far !== null && !isNaN(near) && !isNaN(far)) {
      const message =
        near === far
          ? `Camera3D 'near' and 'far' clipping planes are both ${near}. Godot cannot build a projection from a zero depth range: it drops the write under perspective and stores an infinite one under orthogonal.`
          : `Camera3D 'near' clipping plane (${near}) must be less than 'far' clipping plane (${far}). Invalid clipping planes will cause rendering issues.`;
      if (near === far || (frustum && near > far)) {
        diagnostics.push({
          severity: 'error',
          message,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'camera3d-invalid-clipping-planes',
        });
      }
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
    description: "Validates the Camera3D near/far clipping-plane pair, which neither plane's own bound can express",
    category: 'validation',
    emits: [
      {
        ruleName: 'camera3d-invalid-clipping-planes',
        severity: 'error',
        grounding: { kind: 'engine', at: 'projection.cpp:367' },
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
