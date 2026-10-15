/**
 * The `get_configuration_warnings()` checks the 3D lights share.
 * Range bands live in each slice's `linterParser.ts`, since an advisory beside a
 * validator bound reports one value twice.
 */

import type { Diagnostic } from '../../../../linter/types.js';
import { armDiagnostic, groundedArm, type RuleArm } from '../../../../linter/ruleArms.js';
import { resourceRef } from '../../../../godot/variant/resourceRef.js';
import { boolSlotValue } from '../../../../godot/variant/variantBool.js';
import type { RawNode } from '../../../../parser/types.js';

/** The warning's arm under `rulePrefix`, the node-type slug, so each light keeps its own rule. */
export function projectorArm(rulePrefix: string): RuleArm {
  return groundedArm(`${rulePrefix}-projector-without-shadow`, { kind: 'configuration-warning' });
}

/**
 * Whether `node` sets a projector: a parseable reference, not merely a present key. Godot's reader
 * rejects a malformed value, so no projector is set, and the validator already reports it.
 */
export function hasProjector(node: RawNode): boolean {
  return resourceRef(node.rawProperties.light_projector ?? '') !== null;
}

/**
 * "Projector texture only works with shadows active." (light_3d.cpp:623-625, :659-661):
 * `has_shadow()` reads `shadow_enabled` (light_3d.cpp:402), and `light_projector` is
 * the serialised key (light_3d.cpp:393).
 */
export function projectorWithoutShadowDiagnostic(node: RawNode, arm: RuleArm): Diagnostic | null {
  if (!hasProjector(node)) return null;
  if (boolSlotValue(node.rawProperties.shadow_enabled) === true) return null;

  return armDiagnostic(
    arm,
    node,
    `${node.type} '${node.name}' has a light_projector texture set, but shadow_enabled is not true. Projector texture only works with shadows active.`
  );
}
