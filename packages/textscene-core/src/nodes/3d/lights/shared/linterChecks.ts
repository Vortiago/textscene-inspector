/**
 * The semantic check OmniLight3D and SpotLight3D share, from Godot's own
 * `get_configuration_warnings()`.
 *
 * Range bands live in the validators, not here: `light_energy`, `omni_range`,
 * `spot_range`, `spot_angle` and `directional_shadow_max_distance` all carry
 * their hint bound in the slice's `linterParser.ts`, and an advisory beside one
 * reports the same value twice.
 */

import type { Diagnostic } from '../../../../linter/types.js';
import type { TscnNode } from '../../../../parser/types.js';
import { resourceRef } from '../../../../godot/index.js';

/**
 * OmniLight3D's and SpotLight3D's shared `light_projector` check — the SAME
 * `RTR` text at both sites:
 *
 *     if (!has_shadow() && get_projector().is_valid()) {
 *         warnings.push_back(RTR("Projector texture only works with shadows active."));
 *     }
 *
 * (light_3d.cpp:623-625 for OmniLight3D, :659-661 for SpotLight3D — `has_shadow()`
 * reads the `shadow_enabled` property, light_3d.cpp:402). `light_projector` is the
 * serialised key (light_3d.cpp:393), not the C++ member `projector`.
 *
 * `rulePrefix` is the node-type slug, so each light keeps its own
 * `<prefix>-projector-without-shadow` rule name.
 */
export function projectorWithoutShadowDiagnostic(
  node: TscnNode,
  rulePrefix: string
): Diagnostic | null {
  const properties = node.properties as unknown as Record<string, string>;
  // A PARSEABLE reference, not merely a present key. Godot's reader rejects a
  // malformed value outright, so no projector is set and there is nothing to
  // warn about; keying off presence reported this beside the format error the
  // validator already raises, two diagnostics for one defect.
  if (!resourceRef(properties.light_projector ?? '')) return null;
  if (properties.shadow_enabled === 'true') return null;

  return {
    severity: 'warning',
    message: `${node.type} '${node.name}' has a light_projector texture set, but shadow_enabled is not true. Projector texture only works with shadows active.`,
    nodeName: node.name,
    nodeType: node.type,
    ruleName: `${rulePrefix}-projector-without-shadow`,
  };
}
