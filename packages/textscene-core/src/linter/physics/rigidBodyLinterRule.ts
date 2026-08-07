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
import { basisColumnScalesGodotFloat } from './basisColumnScales.js';
import { makeFloatTupleRegex } from '../validators/floatTupleValidator.js';
import { tupleComponent } from '../validators/commonValidators.js';

/**
 * `mass` hint, rigid_body_2d.cpp:742 / rigid_body_3d.cpp:764 —
 * PROPERTY_HINT_RANGE "0.001,1000,0.001,or_greater,exp,suffix:kg". The high end
 * is open, so only the low end is advisory; mass <= 0 is refused outright by
 * ERR_FAIL_COND in the setter (:318 / :334) and is linterParser.ts's error.
 */
const MASS_HINT_MIN = 0.001;

/**
 * Per-axis scale tolerance, shared by both dimensions: rigid_body_3d.cpp:667
 * and rigid_body_2d.cpp:648, `Math::abs(scale.n - 1.0) > 0.05`. NOT the
 * pairwise x≈y≈z uniformity test `collisionobject3d-non-uniform-scale` and
 * `collisionshape3d-non-uniform-scale` run (collision_object_3d.cpp:744,
 * collision_shape_3d.cpp:155) — a UNIFORM (2,2,2) scale trips this one too.
 *
 * Declared locally (matching `MASS_HINT_MIN` above) rather than in
 * `godot/math.ts`: this repo's engine-facts module has no home for it yet,
 * flagged as a `godot/math.ts` candidate rather than added here on this
 * rule's own authority.
 */
const RIGID_BODY_SCALE_TOLERANCE = 0.05;

const SCALE_VECTOR2_RE = makeFloatTupleRegex('Vector2', 2);

/**
 * Node2D's own `scale` (node_2d.cpp:499), defaulting to `(1, 1)` when absent —
 * the field default (node_2d.h:39) and the serialised default agree, so an
 * absent key is never the trigger. `transform` is NOT read as a fallback:
 * unlike Node3D, Node2D's `transform` ADD_PROPERTY carries
 * `PROPERTY_USAGE_NONE` (node_2d.cpp:501) and is never written by the engine.
 */
function parseScale2D(raw: string | undefined): { x: number; y: number } {
  if (raw === undefined) return { x: 1, y: 1 };
  const match = SCALE_VECTOR2_RE.exec(raw);
  if (!match) return { x: 1, y: 1 }; // malformed is linterParser.ts's job, not this rule's
  return { x: tupleComponent(match[1]), y: tupleComponent(match[2]) };
}

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

    // Warning: per-axis scale the physics engine overrides at runtime (3D —
    // rigid_body_3d.cpp:667; the 2D counterpart is the branch below). Reaches
    // VehicleBody3D too, via the matcher below.
    if (dim === '3D' && rawProps.transform !== undefined) {
      // Godot-float-grammar parsing, not `basisColumnScales`: rigid_body_3d.cpp:667
      // measures `abs(scale.axis - 1) > 0.05`, which is true for an infinite
      // basis column and false for a `nan` one — a distinction
      // `basisColumnScales.ts`'s docblock explains this variant exists to keep.
      const scales = basisColumnScalesGodotFloat(rawProps.transform);
      if (scales) {
        const [sx, sy, sz] = scales;
        const overridden =
          Math.abs(sx - 1) > RIGID_BODY_SCALE_TOLERANCE ||
          Math.abs(sy - 1) > RIGID_BODY_SCALE_TOLERANCE ||
          Math.abs(sz - 1) > RIGID_BODY_SCALE_TOLERANCE;
        if (overridden) {
          const shown = [sx, sy, sz].map((s) => Number(s.toFixed(3))).join(', ');
          diagnostics.push({
            severity: 'warning',
            message:
              `${type} '${node.name}' has a scaled transform (${shown}). ` +
              'Scale changes to RigidBody3D will be overridden by the physics engine when running. ' +
              'Change the size in its children collision shapes instead.',
            nodeName: node.name,
            nodeType: node.type,
            ruleName: `${prefix}-scale-overridden-at-runtime`,
          });
        }
      }
    }

    // Warning: per-axis scale the physics engine overrides at runtime (2D —
    // rigid_body_2d.cpp:648, `Math::abs(t.columns[n].length() - 1.0) > 0.05`).
    // `columns[n].length()` is the UNSIGNED axis magnitude, which for a
    // discrete position/rotation/scale/skew transform equals `|scale.n|`
    // regardless of rotation or skew (neither changes a column's length) — so
    // reading `scale` directly reproduces it without composing a matrix.
    // Reaches PhysicalBone2D too, which inherits this check unchanged
    // (physical_bone_2d.cpp:109, `RigidBody2D::get_configuration_warnings()`).
    if (dim === '2D') {
      const scale = parseScale2D(rawProps.scale);
      const sx = Math.abs(scale.x);
      const sy = Math.abs(scale.y);
      if (Math.abs(sx - 1) > RIGID_BODY_SCALE_TOLERANCE || Math.abs(sy - 1) > RIGID_BODY_SCALE_TOLERANCE) {
        diagnostics.push({
          severity: 'warning',
          message:
            `${type} '${node.name}' has scale (${scale.x}, ${scale.y}). ` +
            'Size changes to RigidBody2D will be overridden by the physics engine when running. ' +
            'Change the size in its children collision shapes instead.',
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-scale-overridden-at-runtime`,
        });
      }
    }

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
        // Dimension-gated: each instantiation emits only its own branch above.
        { ruleName: `${prefix}-scale-overridden-at-runtime`, severity: 'warning' },
      ],
    },
    check,
  };
}
