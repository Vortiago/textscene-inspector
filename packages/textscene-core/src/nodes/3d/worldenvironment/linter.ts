/**
 * Semantic linter rules for WorldEnvironment that need the whole scene: a resource in either slot,
 * and which node wins each first-wins group. linterParser.ts checks the reference format.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnNode } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { heldResource } from '../../../linter/resourceChecker.js';
import { firstNodeOfType, isValidProperties } from '../../../linter/linterUtils.js';
import { parseResourceReference } from '../../../resources/SubResourceResolver.js';

/**
 * The three first-wins groups, one per resource slot. `_notification` gates each `add_to_group` on
 * that slot's `is_valid()` (world_environment.cpp:39-52), and each `_update_current_*` reads only its
 * own group (:75-105), with a matching warning per slot (:195-205). So a node can win the
 * Environment group and still be ignored for its Compositor.
 */
const FIRST_WINS_SLOTS = ['environment', 'camera_attributes', 'compositor'] as const;

/**
 * The engine's own sentence per slot, trimmed of the "(or set of instantiated
 * scenes)" clause this file cannot see across. A `Record` over the slot union,
 * so a slot added above without a sentence is a type error rather than an
 * undefined tail.
 */
const GROUP_WARNING: Record<(typeof FIRST_WINS_SLOTS)[number], string> = {
  environment: 'Only the first Environment has an effect.',
  camera_attributes: 'Only one WorldEnvironment is allowed per scene.',
  compositor: 'Only the first Compositor has an effect.',
};

/** `<slot>.is_valid()`, the gate on joining that slot's group (world_environment.cpp:39-52). */
function declaresSlot(node: TscnNode, key: string): boolean {
  return isValidProperties(node.properties) && heldResource(node.properties[key]) !== undefined;
}

/**
 * `Ref` identity, spelled the way two references to one resource compare equal.
 * Takes the HELD reference, so the empty-slot question is asked once per slot.
 */
function resourceRefId(held: string | undefined): string | undefined {
  if (held === undefined) return undefined;
  const parsed = parseResourceReference(held);
  return parsed ? `${parsed.type}:${parsed.id}` : held;
}

function checkWorldEnvironment(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  const rawProps = node.properties as unknown as Record<string, string>;

  // Godot's guard is `environment.is_null() && camera_attributes.is_null()`
  // (world_environment.cpp:187), so a camera_attributes-only WorldEnvironment is valid. An absent
  // key, an empty value and a bare `null` are one state to a `Ref`, so each gate reads the held
  // reference, not the raw text.
  if (
    heldResource(rawProps.environment) === undefined &&
    heldResource(rawProps.camera_attributes) === undefined
  ) {
    diagnostics.push({
      severity: 'warning',
      message: `WorldEnvironment has neither an 'environment' nor a 'camera_attributes' resource, so it has no visible effect.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'worldenvironment-requires-environment',
    });
  }

  // world_environment.cpp:195-205 warns when `<slot>.is_valid()` and the world holds another node's
  // resource, taken from `get_first_node_in_group` (:75-105). The group sorts in tree order
  // (scene_tree.cpp:333-347 with node.h:132-134), so the winner is the first WorldEnvironment in
  // the file whose slot is valid, since `add_to_group` is gated on that slot's `is_valid()`.
  for (const key of FIRST_WINS_SLOTS) {
    const held = heldResource(rawProps[key]);
    if (held === undefined) continue;
    // A WorldEnvironment behind `instance=` can be the real first and is invisible here. The group
    // key also carries the World3D scenario id, so a SubViewport with `own_world_3d` has its own
    // group. That scoping is not modelled.
    const first = firstNodeOfType(scene.nodes, 'WorldEnvironment', (n) => declaresSlot(n, key));
    if (node === first) continue;
    const winningId = first && isValidProperties(first.properties)
      ? resourceRefId(heldResource(first.properties[key]))
      : undefined;
    // `!=` on a `Ref` is instance identity: two nodes naming one `ExtResource` share an instance,
    // and `SubResource("e")` is `SubResource( "e" )`, so compare resource ids, not the raw text.
    if (resourceRefId(held) === winningId) continue;
    diagnostics.push({
      severity: 'warning',
      message: `WorldEnvironment '${node.name}' is not the first in the scene to declare '${key}', and the resource it names is not the one that first node declares, so Godot ignores it. ${GROUP_WARNING[key]}`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'single-worldenvironment',
    });
  }

  return diagnostics;
}

const worldEnvironmentValidationRule: LintRule = {
  meta: {
    name: 'valid-worldenvironment',
    description: 'Validates WorldEnvironment resource presence and which WorldEnvironment wins each first-wins group',
    category: 'validation',
    applicableNodeTypes: ['WorldEnvironment'],
    emits: [
      { ruleName: 'worldenvironment-requires-environment', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      {
        ruleName: 'single-worldenvironment',
        severity: 'warning',
        grounding: { kind: 'configuration-warning' },
      },
    ],
  },
  check: checkWorldEnvironment,
};

ruleRegistry.register(worldEnvironmentValidationRule);

export { worldEnvironmentValidationRule };
