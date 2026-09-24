/**
 * The `get_configuration_warnings()` check OmniLight3D and SpotLight3D share.
 * Range bands live in each slice's `linterParser.ts`, since an advisory beside a
 * validator bound reports one value twice.
 */

import type { Diagnostic } from '../../../../linter/types.js';
import type { TscnNode } from '../../../../parser/types.js';
import { resourceRef, boolSlotValue} from '../../../../godot/index.js';

/**
 * "Projector texture only works with shadows active." (light_3d.cpp:623-625, :659-661):
 * `has_shadow()` reads `shadow_enabled` (light_3d.cpp:402), and `light_projector` is
 * the serialised key (light_3d.cpp:393). `rulePrefix` is the node-type slug, so each
 * light keeps its own `<prefix>-projector-without-shadow` rule.
 */
export function projectorWithoutShadowDiagnostic(
  node: TscnNode,
  rulePrefix: string
): Diagnostic | null {
  const properties = node.properties as unknown as Record<string, string>;
  // A parseable reference, not merely a present key: Godot's reader rejects a
  // malformed value, so no projector is set, and the validator already reports it.
  if (!resourceRef(properties.light_projector ?? '')) return null;
  if (boolSlotValue(properties.shadow_enabled) === true) return null;

  return {
    severity: 'warning',
    message: `${node.type} '${node.name}' has a light_projector texture set, but shadow_enabled is not true. Projector texture only works with shadows active.`,
    nodeName: node.name,
    nodeType: node.type,
    ruleName: `${rulePrefix}-projector-without-shadow`,
  };
}
