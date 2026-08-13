/**
 * Dimension-parameterized semantic linter rule for Area2D / Area3D.
 *
 * The two slices were byte-identical after a 2D↔3D token swap, so a single
 * factory builds both. Format validation stays in each slice's linterParser.ts;
 * this rule handles the semantic checks that need full scene context.
 */

import { parseGodotInt } from '../validators/commonValidators.js';
import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import {
  hasCollisionShapeChild,
  collisionShapeTypesPhrase,
} from './hasCollisionShapeChild.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';

export function makeAreaLinterRule(dim: PhysicsDim): LintRule {
  // What an area pair does with the two monitor flags: detection needs the
  // monitoring side's callback AND the detected side's `monitorable`. Each
  // dimension has its own copy of the pair, so one literal cannot serve both.
  const monitorFlagsCite =
    dim === '2D' ? 'godot_area_pair_2d.cpp:134' : 'godot_area_pair_3d.cpp:135';
  // The mask test that decides whether an area sees a body at all:
  // `area->collides_with(body)`, the body's collision_layer against the AREA's
  // collision_mask. Jolt states the same rule at jolt_area_3d.cpp:451.
  const areaMaskCite = dim === '2D' ? 'godot_area_pair_2d.cpp:36' : 'godot_area_pair_3d.cpp:37';
  const type = `Area${dim}`;
  const prefix = `area${dimSuffix(dim)}`;

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node } = context;


    // Access raw properties from the node (Record<string, string>)
    const rawProps = node.properties as unknown as Record<string, string>;

    // Warning: Area without collision shape won't detect anything
    if (!hasCollisionShapeChild(node, dim)) {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has no ${collisionShapeTypesPhrase(dim)} children. Areas need collision shapes to detect bodies entering/exiting.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-needs-collision-shape`,
      });
    }

    // Godot raises no warning for this either — no `get_configuration_warnings()`
    // override checks it. Grounded instead in what the two flags DO
    // (area_2d.cpp / area_3d.cpp: `monitoring` drives whether the area
    // scans for bodies/areas, `monitorable` whether other monitors can find
    // it): with both false, the node can neither detect anything nor be
    // detected by anything.
    //
    // DETECTION only, which is why this is not called "inactive". The pair's
    // `has_space_override` is computed from the gravity/damp override modes
    // alone and `pre_solve` calls `body->add_area(area)` on that flag
    // (godot_area_pair_2d.cpp:41-50, :68-71); `has_monitor_callback()` gates
    // nothing but the body-to-query call beside it. A non-monitoring area is
    // still a working gravity, damping and audio-bus zone.
    const monitoring = rawProps.monitoring ?? 'true'; // Default is true in Godot
    const monitorable = rawProps.monitorable ?? 'true'; // Default is true in Godot
    if (monitoring === 'false' && monitorable === 'false') {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has both 'monitoring' and 'monitorable' set to false, so it detects no bodies or areas and no other area detects it. Its gravity, damping and audio-bus overrides still apply.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-detects-nothing`,
      });
    }

    // No point-gravity distance rules: `gravity_point_unit_distance` defaults
    // to 0.0, which is a documented, meaningful configuration ("gravity will
    // be constant regardless of distance", Area3D.xml) — and Godot's
    // serializer omits default-valued properties, so absence is the normal
    // form. Negative explicit values are outside the property's range hint
    // ("0,1024,0.001,or_greater") and are rejected by each slice's format
    // validator instead.

    // No `collision_layer` check of any kind: no engine warning exists for it,
    // AND the premise was wrong. Area monitoring matches a target body's
    // `collision_layer` against the AREA's `collision_mask`, not against the
    // area's own `collision_layer`, so the area's layer has no bearing on what
    // it detects. It fired on shipped Godot demos that set `collision_layer = 0`
    // deliberately.

    // Warning: collision_mask is 0 and monitoring is true (won't detect anything)
    const collisionMask = rawProps.collision_mask;
    if (monitoring === 'true' && collisionMask !== undefined) {
      // `parseGodotInt`, not `parseInt`: the latter stops at the first
      // character it cannot use, so `1e-1` read as 1 and missed the zero mask
      // Godot actually stores.
      const mask = parseGodotInt(collisionMask);
      if (mask === 0) {
        diagnostics.push({
          severity: 'warning',
          message: `${type} '${node.name}' has 'monitoring' enabled but 'collision_mask' is 0. The area won't detect any collision layers.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-monitoring-zero-mask`,
        });
      }
    }

    // No `audio_bus_override` + missing `audio_bus_name` check: `audio_bus` has
    // no initialiser and `get_audio_bus_name()` returns Master for any unset or
    // unknown name, so absence IS the default and Godot omits the key.

    return diagnostics;
  }

  return {
    meta: {
      name: `valid-${prefix}`,
      description: `Validates ${type} collision shapes, monitoring configuration, gravity settings, and physics overrides`,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: [
        {
          ruleName: `${prefix}-needs-collision-shape`,
          severity: 'warning',
          grounding: { kind: 'configuration-warning' },
        },
        {
          ruleName: `${prefix}-detects-nothing`,
          severity: 'warning',
          grounding: {
            kind: 'engine-inert',
            at: monitorFlagsCite,
            unused: 'a non-monitoring area never registers the callback this line requires',
          },
        },
        {
          ruleName: `${prefix}-monitoring-zero-mask`,
          severity: 'warning',
          grounding: {
            kind: 'engine-inert',
            at: areaMaskCite,
            unused: 'collides_with returns false for every layer, so monitoring detects nothing',
          },
        },
      ],
    },
    check,
  };
}
