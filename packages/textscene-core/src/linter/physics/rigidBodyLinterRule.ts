/**
 * Dimension-parameterized semantic linter rule for RigidBody2D / RigidBody3D.
 *
 * The two slices were identical apart from the 2D↔3D token, so a single factory
 * builds both. Format validation (mass > 0, enum values, vector format, etc.)
 * stays in each slice's linterParser.ts; this rule handles the semantic checks
 * that need full scene context (resource references, collision-shape children).
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { checkResourceExists } from '../resourceChecker.js';
import {
  hasCollisionShapeDescendant,
  collisionShapeTypesPhrase,
} from './hasCollisionShapeDescendant.js';
import { pushZeroCollisionLayerMaskWarnings } from './collisionLayerMask.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';
import { descendsFrom } from '../nodeBaseTypes.js';
import { rangeAdvisories } from '../rangeAdvisory.js';

/**
 * `mass` hint, rigid_body_2d.cpp:742 / rigid_body_3d.cpp:764 —
 * PROPERTY_HINT_RANGE "0.001,1000,0.001,or_greater,exp,suffix:kg". The high end
 * is open, so only the low end is advisory; mass <= 0 is refused outright by
 * ERR_FAIL_COND in the setter (:318 / :334) and is linterParser.ts's error.
 */
const MASS_HINT_MIN = 0.001;

export function makeRigidBodyLinterRule(dim: PhysicsDim): LintRule {
  const type = `RigidBody${dim}`;
  const prefix = `rigidbody${dimSuffix(dim)}`;
  const massHintCite = dim === '2D' ? 'rigid_body_2d.cpp:742' : 'rigid_body_3d.cpp:764';

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node, scene } = context;


    // Access raw properties from the node (Record<string, string>)
    const rawProps = node.properties as unknown as Record<string, string>;

    // Check if physics_material_override resource exists (if specified)
    if (rawProps.physics_material_override) {
      const resourceExists = checkResourceExists(scene, rawProps.physics_material_override);
      if (!resourceExists) {
        diagnostics.push({
          severity: 'error',
          message: `Physics material resource not found: ${rawProps.physics_material_override}`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `valid-${prefix}-resources`,
        });
      }
    }

    // Warning: RigidBody without collision shape is useless
    if (!hasCollisionShapeDescendant(node, dim)) {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has no ${collisionShapeTypesPhrase(dim)} children. Rigid bodies need collision shapes to function in physics.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-needs-collision-shape`,
      });
    }

    // Warning: mass below the range the inspector offers. `floor: 0` leaves
    // mass <= 0 to the setter-backed error rather than double-reporting it.
    diagnostics.push(
      ...rangeAdvisories(node, {
        mass: [
          {
            under: MASS_HINT_MIN,
            floor: 0,
            ruleName: `${prefix}-mass-too-low`,
            message: (mass) =>
              `${type} '${node.name}' has mass ${mass}. The editor range for mass starts at ${MASS_HINT_MIN}.`,
            cite: massHintCite,
          },
        ],
      })
    );

    // `linear_damp` / `angular_damp` get no advisory: both hints
    // (rigid_body_2d.cpp:763/767 "-1,100,0.001,or_greater",
    // rigid_body_3d.cpp:785/789 "0,100,0.001,or_greater") leave the high end
    // open, and their low ends are exactly the setters' ERR_FAIL_COND bounds
    // (2D :425/:435 reject < -1, 3D :443/:453 reject < 0), which
    // linterParser.ts reports as errors.

    // Warning: max_contacts_reported set but contact_monitor=false
    if (rawProps.max_contacts_reported !== undefined) {
      const contactMonitor = rawProps.contact_monitor;
      if (contactMonitor !== 'true') {
        diagnostics.push({
          severity: 'warning',
          message: `${type} '${node.name}' has max_contacts_reported set but contact_monitor is not enabled. The property won't work unless contact_monitor=true.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-max-contacts-without-monitor`,
        });
      }
    }

    pushZeroCollisionLayerMaskWarnings(diagnostics, node, rawProps, type, prefix);

    return diagnostics;
  }

  return {
    meta: {
      name: `valid-${prefix}`,
      description: `Validates ${type} resource references, collision shapes, mass values, and physics configuration`,
      category: 'validation',
      applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, type),
      emits: [
        { ruleName: `valid-${prefix}-resources`, severity: 'error' },
        { ruleName: `${prefix}-needs-collision-shape`, severity: 'warning' },
        { ruleName: `${prefix}-mass-too-low`, severity: 'warning' },
        { ruleName: `${prefix}-max-contacts-without-monitor`, severity: 'warning' },
        { ruleName: `${prefix}-zero-collision-layer`, severity: 'warning' },
        { ruleName: `${prefix}-zero-collision-mask`, severity: 'warning' },
      ],
    },
    check,
  };
}
