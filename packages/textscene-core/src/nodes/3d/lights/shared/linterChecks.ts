/**
 * The `get_configuration_warnings()` check OmniLight3D and SpotLight3D share.
 * Range bands live in each slice's `linterParser.ts`, since an advisory beside a
 * validator bound reports one value twice.
 */

import type { Diagnostic } from '../../../../linter/types.js';
import type { TscnNode } from '../../../../parser/types.js';
import { armDiagnostic, type RuleArms } from '../../../../linter/ruleArms.js';
import { resourceRef, boolSlotValue} from '../../../../godot/index.js';

/** The warning's arm under `rulePrefix`, the node-type slug, so each light keeps its own rule. */
export function projectorArms(rulePrefix: string) {
  const arms = {
    projectorWithoutShadow: {
      severity: 'warning',
      ruleName: `${rulePrefix}-projector-without-shadow`,
      grounding: { kind: 'configuration-warning' },
    },
  } as const satisfies RuleArms<string>;
  return arms;
}

type ProjectorArms = ReturnType<typeof projectorArms>;

/**
 * "Projector texture only works with shadows active." (light_3d.cpp:623-625, :659-661):
 * `has_shadow()` reads `shadow_enabled` (light_3d.cpp:402), and `light_projector` is
 * the serialised key (light_3d.cpp:393).
 */
export function projectorWithoutShadowDiagnostic(node: TscnNode, arms: ProjectorArms): Diagnostic | null {
  const properties = node.properties as unknown as Record<string, string>;
  // A parseable reference, not merely a present key: Godot's reader rejects a
  // malformed value, so no projector is set, and the validator already reports it.
  if (!resourceRef(properties.light_projector ?? '')) return null;
  if (boolSlotValue(properties.shadow_enabled) === true) return null;

  return armDiagnostic(
    arms.projectorWithoutShadow,
    node,
    `${node.type} '${node.name}' has a light_projector texture set, but shadow_enabled is not true. Projector texture only works with shadows active.`
  );
}
