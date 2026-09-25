/**
 * The RigidBody2D/3D rules that need full scene context. Format validation (mass > 0,
 * enum values, vector format and so on) stays in each slice's linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';
import { descendsFrom } from '../../godot/nodeBaseTypes.js';
import { basisColumnScalesGodotFloat } from './basisColumnScales.js';
import { VECTOR2_REGEX } from '../validators/vectorValidators.js';
import { slotComponents, slotComponentsAltered } from '../../godot/int.js';
import { ruleInt, tupleComponent } from '../validators/commonValidators.js';
import { boolSlotValue } from '../../godot/index.js';

/**
 * Per-axis scale tolerance: rigid_body_3d.cpp:667 and rigid_body_2d.cpp:648,
 * `Math::abs(scale.n - 1.0) > 0.05`. Not the pairwise uniformity test of
 * collision_object_3d.cpp:744 and collision_shape_3d.cpp:155: a uniform (2,2,2) trips
 * this one. A rigid-body tolerance with one reader, so it stays out of `godot/`.
 */
const RIGID_BODY_SCALE_TOLERANCE = 0.05;

/**
 * Node2D's own `scale` (node_2d.cpp:499), `(1, 1)` when absent, since the field
 * default (node_2d.h:39) and the serialised default agree. Not `transform`: Node2D's
 * `transform` carries `PROPERTY_USAGE_NONE` (node_2d.cpp:501) and is never written.
 */
function parseScale2D(raw: string | undefined): { x: number; y: number } | null {
  if (raw === undefined) return { x: 1, y: 1 };
  const match = VECTOR2_REGEX.exec(raw);
  if (!match) return { x: 1, y: 1 }; // malformed is linterParser.ts's job, not this rule's
  const captures = [match[1], match[2]];
  // `null`, not the NaN `slotComponents` answers with: the engine stores a number
  // the file does not state, and none this rule may name, since `_to_int`'s float
  // branch is undefined behaviour (variant.h:369-370). A NaN would reach the message.
  if (slotComponentsAltered(raw, 'Vector2', captures)) return null;
  // `slotComponents`: the grammar admits the `Vector2i(...)` spelling Godot
  // converts, whose arguments are narrowed to int32 before the widening, so
  // `Vector2i(0.5, 1)` scales by the (0, 1) the engine stores.
  const [x, y] = slotComponents(raw, 'Vector2', captures, tupleComponent);
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
  // guard above, this one does not coincide: the 3D body assigns an inverse inertia
  // tensor the 2D one has no counterpart for, putting the line one earlier.
  const countLine = dim === '2D' ? 155 : 154;

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node } = context;
    const rawProps = node.properties as unknown as Record<string, string>;

    // `linear_damp` / `angular_damp` get no advisory: both hints (rigid_body_2d.cpp:763/767
    // "-1,100,0.001,or_greater", rigid_body_3d.cpp:785/789 "0,100,0.001,or_greater") leave
    // the high end open, and each low end is the setter's ERR_FAIL_COND bound (2D :425/:435
    // reject < -1, 3D :443/:453 reject < 0), which linterParser.ts reports as an error.

    // max_contacts_reported > 0 but contact_monitor is off. The flag gates the contact
    // list and the signals, not the count: `_sync_body_state` writes `contact_count`
    // unconditionally (:155, called at :179 ahead of the guard), and the server's
    // `can_report_contacts()` is `!contacts.is_empty()`, sized by max_contacts_reported.
    const maxContacts = ruleInt(rawProps.max_contacts_reported, 0);
    // The value, not the key: 0 is the default (rigid_body_2d.h:85, rigid_body_3d.h:82)
    // and sizes the list to nothing, and an unreadable literal never landed.
    if (maxContacts !== null && maxContacts > 0) {
      const contactMonitor = rawProps.contact_monitor;
      if (boolSlotValue(contactMonitor) !== true) {
        diagnostics.push({
          severity: 'info',
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

    // Per-axis scale the physics engine overrides at runtime (3D: rigid_body_3d.cpp:667,
    // with 2D below). The matcher reaches VehicleBody3D too.
    if (dim === '3D' && rawProps.transform !== undefined) {
      // The Godot-float, signed variant: rigid_body_3d.cpp:666's `abs(scale.axis - 1) > 0.05`
      // is true for an infinite column and false for a `nan` one, and comparing each
      // axis against 1.0 does not cancel `get_scale`'s shared `det_sign`.
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

    // Per-axis scale overridden at runtime (2D: rigid_body_2d.cpp:648,
    // `Math::abs(t.columns[n].length() - 1.0) > 0.05`). An unsigned column length is
    // `|scale.n|` whatever the rotation or skew, so reading `scale` needs no matrix.
    const scale2D = dim === '2D' ? parseScale2D(rawProps.scale) : null;
    // PhysicalBone2D inherits this check (physical_bone_2d.cpp:109). A narrowed
    // component gives `null` and no report, since no scale may be quoted, and
    // `v.vector2('scale')` on Node2D checks only the shape.
    if (scale2D !== null) {
      const sx = Math.abs(scale2D.x);
      const sy = Math.abs(scale2D.y);
      if (Math.abs(sx - 1) > RIGID_BODY_SCALE_TOLERANCE || Math.abs(sy - 1) > RIGID_BODY_SCALE_TOLERANCE) {
        diagnostics.push({
          severity: 'warning',
          message:
            `${node.type} '${node.name}' has scale (${scale2D.x}, ${scale2D.y}). ` +
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
          ruleName: `${prefix}-max-contacts-without-monitor`,
          severity: 'info',
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
