/**
 * The Area2D/Area3D rules that need full scene context. Format validation stays
 * in each slice's linterParser.ts.
 */

import { ruleInt } from '../validators/commonValidators.js';
import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';
import { boolSlotValue } from '../../godot/index.js';

export function makeAreaLinterRule(dim: PhysicsDim): LintRule {
  // What an area pair does with the two monitor flags: detection needs the
  // monitoring side's callback and the detected side's `monitorable`. Each
  // dimension has its own copy of the pair, so one literal cannot serve both.
  const monitorFlagsCite =
    dim === '2D' ? 'godot_area_pair_2d.cpp:134' : 'godot_area_pair_3d.cpp:135';
  // The mask test that decides whether an area sees a body at all:
  // `area->collides_with(body)`, the body's collision_layer against the area's
  // collision_mask. Jolt states the same rule at jolt_area_3d.cpp:451.
  const areaMaskCite = dim === '2D' ? 'godot_area_pair_2d.cpp:36' : 'godot_area_pair_3d.cpp:37';
  const type = `Area${dim}`;
  const prefix = `area${dimSuffix(dim)}`;

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node } = context;
    const rawProps = node.properties as unknown as Record<string, string>;

    // No `get_configuration_warnings()` override checks the flags, both true by
    // default: `monitoring` drives whether the area scans for bodies and areas,
    // `monitorable` whether other monitors find it (area_2d.cpp / area_3d.cpp).
    const monitoring = rawProps.monitoring ?? 'true';
    const monitorable = rawProps.monitorable ?? 'true';
    // Detection only, not "inactive": `pre_solve` calls `body->add_area(area)` on
    // `has_space_override`, from the gravity and damp modes alone (godot_area_pair_2d.cpp:41-50,
    // :68-71), and `has_monitor_callback()` gates only the body-to-query call.
    if (boolSlotValue(monitoring) === false && boolSlotValue(monitorable) === false) {
      diagnostics.push({
        severity: 'info',
        message: `${type} '${node.name}' has both 'monitoring' and 'monitorable' set to false, so it detects no bodies or areas and no other area detects it. Its gravity, damping and audio-bus overrides still apply.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-detects-nothing`,
      });
    }

    // No point-gravity distance rule: `gravity_point_unit_distance` defaults to 0.0,
    // a meaningful setting ("gravity will be constant regardless of distance",
    // Area3D.xml) that the serialiser omits. A negative value is outside the hint
    // "0,1024,0.001,or_greater", and each slice's format validator rejects it.

    // No `collision_layer` check: no engine warning exists, and monitoring matches
    // a target body's `collision_layer` against the area's `collision_mask`, so the
    // area's own layer has no bearing on what it detects.

    // collision_mask is 0 while monitoring is true: it detects nothing.
    const collisionMask = rawProps.collision_mask;
    // `?? true`, not `=== true`: an unreadable value is a write Godot refuses, so
    // the constructor's `set_monitoring(true)` stands, as for an absent key.
    if ((boolSlotValue(monitoring) ?? true) && collisionMask !== undefined) {
      // `ruleInt`, not `parseInt`, which stops at the first character it cannot use
      // and reads `1e-1` as 1, missing the zero mask Godot stores. uint32_t setter
      // (collision_object_2d.h:124, collision_object_3d.h:133).
      const mask = ruleInt(collisionMask, null, 'uint32');
      if (mask === 0) {
        diagnostics.push({
          severity: 'info',
          message: `${type} '${node.name}' has 'monitoring' enabled but 'collision_mask' is 0. The area won't detect any collision layers.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-monitoring-zero-mask`,
        });
      }
    }

    // No `audio_bus_override` + missing `audio_bus_name` check: `audio_bus` has
    // no initialiser and `get_audio_bus_name()` returns Master for any unset or
    // unknown name, so absence is the default and Godot omits the key.

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
          ruleName: `${prefix}-detects-nothing`,
          severity: 'info',
          grounding: {
            kind: 'engine-inert',
            at: monitorFlagsCite,
            unused: 'a non-monitoring area never registers the callback this line requires',
          },
        },
        {
          ruleName: `${prefix}-monitoring-zero-mask`,
          severity: 'info',
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
