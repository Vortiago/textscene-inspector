/**
 * Dimension-parameterized semantic linter rule for RigidBody2D / RigidBody3D.
 *
 * The two slices were identical apart from the 2D↔3D token, so a single factory
 * builds both. Format validation (mass > 0, enum values, vector format, etc.)
 * stays in each slice's linterParser.ts; this rule handles the semantic checks
 * that need full scene context (resource references, collision-shape children).
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { checkResourceExists, heldResource } from '../resourceChecker.js';
import {
  hasCollisionShapeChild,
  collisionShapeTypesPhrase,
} from './hasCollisionShapeChild.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';
import { descendsFrom } from '../../godot/nodeBaseTypes.js';
import { basisColumnScalesGodotFloat } from './basisColumnScales.js';
import { VECTOR2_REGEX } from '../validators/vectorValidators.js';
import { slotComponents } from '../../godot/int.js';
import { tupleComponent } from '../validators/commonValidators.js';
import { boolSlotValue } from '../../godot/index.js';

/**
 * Per-axis scale tolerance, shared by both dimensions: rigid_body_3d.cpp:667
 * and rigid_body_2d.cpp:648, `Math::abs(scale.n - 1.0) > 0.05`. NOT the
 * pairwise x≈y≈z uniformity test `collisionobject3d-non-uniform-scale` and
 * `collisionshape3d-non-uniform-scale` run (collision_object_3d.cpp:744,
 * collision_shape_3d.cpp:155) — a UNIFORM (2,2,2) scale trips this one too.
 *
 * Local rather than in `godot/`: it is a rigid-body tolerance, not a maths
 * constant, and this is its only reader.
 */
const RIGID_BODY_SCALE_TOLERANCE = 0.05;


/**
 * Node2D's own `scale` (node_2d.cpp:499), defaulting to `(1, 1)` when absent —
 * the field default (node_2d.h:39) and the serialised default agree, so an
 * absent key is never the trigger. `transform` is NOT read as a fallback:
 * unlike Node3D, Node2D's `transform` ADD_PROPERTY carries
 * `PROPERTY_USAGE_NONE` (node_2d.cpp:501) and is never written by the engine.
 */
function parseScale2D(raw: string | undefined): { x: number; y: number } {
  if (raw === undefined) return { x: 1, y: 1 };
  const match = VECTOR2_REGEX.exec(raw);
  if (!match) return { x: 1, y: 1 }; // malformed is linterParser.ts's job, not this rule's
  // `slotComponents`: the grammar admits the `Vector2i(...)` spelling Godot
  // converts, whose arguments are narrowed to int32 before the widening, so
  // `Vector2i(0.5, 1)` scales by the (0, 1) the engine stores.
  const [x, y] = slotComponents(raw, 'Vector2', [match[1], match[2]], tupleComponent);
  return { x: x!, y: y! };
}

export function makeRigidBodyLinterRule(dim: PhysicsDim): LintRule {
  const type = `RigidBody${dim}`;
  const prefix = `rigidbody${dimSuffix(dim)}`;
  // `_body_state_changed` reads the contact list, and everything
  // `max_contacts_reported` bounds, only inside `if (contact_monitor)`. Same
  // line number in both files, but they are two separate facts.
  const bodyFile = dim === '2D' ? 'rigid_body_2d.cpp' : 'rigid_body_3d.cpp';
  const contactMonitorCite = `${bodyFile}:181`;
  // `_sync_body_state`'s `contact_count = p_state->get_contact_count()`. Unlike the
  // guard above, this one does NOT coincide: the 3D body assigns an inverse inertia
  // tensor the 2D one has no counterpart for, putting the line one earlier.
  const countLine = dim === '2D' ? 155 : 154;

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node, scene } = context;

    // Access raw properties from the node (Record<string, string>)
    const rawProps = node.properties as unknown as Record<string, string>;

    // Check if physics_material_override resource exists (if specified)
    const physicsMaterial = heldResource(rawProps.physics_material_override);
    if (physicsMaterial !== undefined) {
      const resourceExists = checkResourceExists(scene, physicsMaterial);
      if (!resourceExists) {
        diagnostics.push({
          severity: 'error',
          message: `Physics material resource not found: ${physicsMaterial}`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `valid-${prefix}-resources`,
        });
      }
    }

    // Warning: RigidBody without collision shape is useless
    if (!hasCollisionShapeChild(node, dim)) {
      diagnostics.push({
        severity: 'warning',
        message: `${node.type} '${node.name}' has no ${collisionShapeTypesPhrase(dim)} children. Rigid bodies need collision shapes to function in physics.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-needs-collision-shape`,
      });
    }

    // `linear_damp` / `angular_damp` get no advisory: both hints
    // (rigid_body_2d.cpp:763/767 "-1,100,0.001,or_greater",
    // rigid_body_3d.cpp:785/789 "0,100,0.001,or_greater") leave the high end
    // open, and their low ends are exactly the setters' ERR_FAIL_COND bounds
    // (2D :425/:435 reject < -1, 3D :443/:453 reject < 0), which
    // linterParser.ts reports as errors.

    // Warning: max_contacts_reported set but contact_monitor=false.
    // The flag gates the contact LIST and the signals, not the reporting itself. `_sync_body_state` writes `contact_count` from the
    // state unconditionally (:155, called at :179 ahead of the guard), and the
    // server's `can_report_contacts()` is `!contacts.is_empty()`, sized by
    // max_contacts_reported alone. Saying the property "won't work" claimed more
    // than the guard supports.
    if (rawProps.max_contacts_reported !== undefined) {
      const contactMonitor = rawProps.contact_monitor;
      if (boolSlotValue(contactMonitor) !== true) {
        diagnostics.push({
          severity: 'warning',
          message:
            `${node.type} '${node.name}' sets max_contacts_reported while contact_monitor is off, ` +
            'so get_colliding_bodies() stays empty and the body_entered/exited signals never ' +
            'fire. The contact COUNT still works: _sync_body_state assigns contact_count at ' +
            `${bodyFile}:${countLine}, before the contact_monitor guard at :181, and the physics server ` +
            'gathers contacts on max_contacts_reported alone (can_report_contacts() is ' +
            'contacts.is_empty() negated). Enable contact_monitor only if you need the list ' +
            'or the signals.',
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-max-contacts-without-monitor`,
        });
      }
    }

    // Warning: per-axis scale the physics engine overrides at runtime (3D —
    // rigid_body_3d.cpp:667; the 2D counterpart is the branch below). Reaches
    // VehicleBody3D too, via the matcher below.
    if (dim === '3D' && rawProps.transform !== undefined) {
      // Godot-float-grammar parsing, not `basisColumnScales`: rigid_body_3d.cpp:666
      // measures `abs(scale.axis - 1) > 0.05`, which is true for an infinite
      // basis column and false for a `nan` one — a distinction
      // `basisColumnScales.ts`'s docblock explains this variant exists to keep.
      // It is also the SIGNED scale, because comparing each axis against 1.0 does
      // not cancel `get_scale`'s shared `det_sign` the way a pairwise test does.
      const scales = basisColumnScalesGodotFloat(rawProps.transform);
      if (scales) {
        const [sx, sy, sz] = scales;
        const overridden =
          Math.abs(sx - 1) > RIGID_BODY_SCALE_TOLERANCE ||
          Math.abs(sy - 1) > RIGID_BODY_SCALE_TOLERANCE ||
          Math.abs(sz - 1) > RIGID_BODY_SCALE_TOLERANCE;
        if (overridden) {
          const shown = [sx, sy, sz].map((s) => Math.round(s * 1000) / 1000).join(', ');
          diagnostics.push({
            severity: 'warning',
            message:
              `${node.type} '${node.name}' has a scaled transform (${shown}). ` +
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
            `${node.type} '${node.name}' has scale (${scale.x}, ${scale.y}). ` +
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
        {
          ruleName: `valid-${prefix}-resources`,
          severity: 'error',
          grounding: {
            kind: 'no-engine-counterpart',
            scope: 'dangling-reference',
            because: 'the physics_material_override id is not declared anywhere in this file',
          },
        },
        {
          ruleName: `${prefix}-needs-collision-shape`,
          severity: 'warning',
          grounding: { kind: 'configuration-warning' },
        },
        {
          ruleName: `${prefix}-max-contacts-without-monitor`,
          severity: 'warning',
          grounding: {
            kind: 'engine-inert',
            at: contactMonitorCite,
            unused: 'the colliding-bodies list and the contact signals live behind this guard',
          },
        },
        {
          ruleName: `${prefix}-scale-overridden-at-runtime`,
          severity: 'warning',
          grounding: { kind: 'configuration-warning' },
        },
      ],
    },
    check,
  };
}
