/**
 * Semantic linter rules for Camera3D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { rangeAdvisories } from '../../../linter/rangeAdvisory.js';
import { descendsFrom } from '../../../linter/nodeBaseTypes.js';

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

  // ERROR: near must be less than far, but ONLY under the frustum projection.
  //
  // `_update_camera_mode` (camera_3d.cpp:102-115) dispatches on `mode`, and only
  // PROJECTION_FRUSTUM reaches `Projection::set_frustum`'s
  // `ERR_FAIL_COND(p_far <= p_near)` (projection.cpp:367, via camera_3d.cpp:280).
  // `Projection::set_perspective` (projection.cpp:252, :278) and `set_orthogonal`
  // (:344, :356) carry no such guard, and `Camera3D::set_near`/`set_far`
  // (camera_3d.cpp:736, :746) assign straight through with no clamp — so on the
  // DEFAULT perspective projection the engine refuses nothing and a degenerate
  // matrix is not an ADR-0032 error. A hint cannot rescue it either: both hints
  // end in `or_greater` and neither constrains the pair.
  if (
    rawProps.near !== undefined &&
    rawProps.far !== undefined &&
    parseInt(rawProps.projection ?? '', 10) === PROJECTION_FRUSTUM
  ) {
    const near = parseFloat(rawProps.near);
    const far = parseFloat(rawProps.far);

    if (!isNaN(near) && !isNaN(far)) {
      if (near >= far) {
        diagnostics.push({
          severity: 'error',
          message: `Camera3D 'near' clipping plane (${near}) must be less than 'far' clipping plane (${far}). Invalid clipping planes will cause rendering issues.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'camera3d-invalid-clipping-planes',
        });
      }
    }
  }

  // Range advisories: clipping planes below the range the editor offers. Both
  // hints end in `or_greater`, so neither has a high bound, and `fov` needs none
  // here — Camera3D::set_fov ERR_FAILs outside 1-179, which linterParser.ts
  // reports as an error.
  diagnostics.push(
    ...rangeAdvisories(node, {
      near: [
        {
          // camera_3d.cpp:685 — near PROPERTY_HINT_RANGE "0.001,10,0.001,or_greater,exp,suffix:m"
          under: 0.001,
          ruleName: 'camera3d-small-near-plane',
          cite: 'camera_3d.cpp:685',
          message: (near) =>
            `Camera3D 'near' clipping plane is ${near}. The editor range for 'near' starts at 0.001; below that, depth precision degrades.`,
        },
      ],
      far: [
        {
          // camera_3d.cpp:686 — far PROPERTY_HINT_RANGE "0.01,4000,0.01,or_greater,exp,suffix:m"
          under: 0.01,
          ruleName: 'camera3d-small-far-plane',
          cite: 'camera_3d.cpp:686',
          message: (far) =>
            `Camera3D 'far' clipping plane is ${far}. The editor range for 'far' starts at 0.01.`,
        },
      ],
    })
  );

  return diagnostics;
}

/**
 * Camera3D semantic validation rule
 */
const camera3DValidationRule: LintRule = {
  meta: {
    name: 'valid-camera3d-properties',
    description: 'Validates Camera3D property values, required properties, clipping plane relationships, and performance considerations',
    category: 'validation',
    emits: [
      {
        ruleName: 'camera3d-invalid-clipping-planes',
        severity: 'error',
        grounding: { kind: 'engine', at: 'projection.cpp:367' },
      },
      {
        ruleName: 'camera3d-small-near-plane',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'camera_3d.cpp:685' },
      },
      {
        ruleName: 'camera3d-small-far-plane',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'camera_3d.cpp:686' },
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
