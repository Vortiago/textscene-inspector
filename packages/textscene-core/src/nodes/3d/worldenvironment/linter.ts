/**
 * Semantic linter rules for WorldEnvironment
 *
 * Note: Format validation (resource reference format) is handled by linterParser.ts
 * during strict parsing. This file focuses on semantic validation that requires
 * full scene context (e.g., resource references exist, multiple WorldEnvironment nodes).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnNode, TscnScene } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists, heldResource } from '../../../linter/resourceChecker.js';
import { firstNodeOfType, isValidProperties } from '../../../linter/linterUtils.js';
import { parseResourceReference, findSubResource } from '../../../resources/SubResourceResolver.js';

/**
 * The three first-wins groups a WorldEnvironment can join, one per resource
 * slot. `_notification` gates each `add_to_group` on that slot's own
 * `is_valid()` (world_environment.cpp:39-52), each `_update_current_*` takes
 * `get_first_node_in_group` for its group alone (:75-105), and
 * `get_configuration_warnings` carries the matching test three times
 * (:195-205). The winners are therefore independent: a node can win the
 * Environment group and still be ignored for its Compositor.
 *
 * `says` is the engine's own sentence for that slot, trimmed of the
 * "(or set of instantiated scenes)" clause this file cannot see across.
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

/**
 * Resolve the `sky` reference stored inside the Environment SubResource that a
 * WorldEnvironment references. Only SubResource environment references can be
 * inspected (ExtResource environments live in another file); returns undefined
 * when the environment isn't a local SubResource or carries no sky property.
 */
function getEnvironmentSkyReference(
  scene: TscnScene,
  environmentRef: string
): string | undefined {
  const parsed = parseResourceReference(environmentRef);
  if (!parsed || parsed.type !== 'SubResource') return undefined;
  const env = findSubResource(scene.internalResources ?? [], parsed.id);
  const sky = env?.data?.sky;
  return typeof sky === 'string' ? sky : undefined;
}

/**
 * Validate WorldEnvironment semantic rules
 */
function checkWorldEnvironment(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;


  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  // One question per slot, asked once: an absent key, an empty value and a bare
  // `null` are one state to every `Ref` below, so each gate reads the held
  // reference rather than the raw text.
  const environment = heldResource(rawProps.environment);
  const cameraAttributes = heldResource(rawProps.camera_attributes);

  // Godot's guard is a conjunction: `environment.is_null() &&
  // camera_attributes.is_null()` (world_environment.cpp:187). EITHER resource
  // gives the node a visible effect, so a camera_attributes-only
  // WorldEnvironment is a valid configuration the engine says nothing about.
  // Testing `environment` alone warned about exactly those scenes.
  if (environment === undefined && cameraAttributes === undefined) {
    diagnostics.push({
      severity: 'warning',
      message: `WorldEnvironment has neither an 'environment' nor a 'camera_attributes' resource, so it has no visible effect.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'worldenvironment-requires-environment',
    });
  }

  // Guarded on its own presence rather than chained to the warning above: since
  // that warning became a conjunction, "no environment" no longer implies the
  // node was reported, and a camera_attributes-only node would have reached here
  // with nothing to resolve.
  if (environment !== undefined) {
    if (!checkResourceExists(scene, environment)) {
      diagnostics.push({
        severity: 'error',
        message: `Environment resource not found: ${environment}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-worldenvironment-resources',
      });
    } else {
      // The Environment subresource may reference a Sky subresource; existence-check
      // it like the environment reference itself (the render parser reads sky too).
      const skyRef = getEnvironmentSkyReference(scene, environment);
      if (skyRef && !checkResourceExists(scene, skyRef)) {
        diagnostics.push({
          severity: 'error',
          message: `Sky resource not found: ${skyRef}`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'valid-worldenvironment-resources',
        });
      }
    }
  }

  // Check if camera_attributes resource exists (if specified - this is optional)
  if (cameraAttributes !== undefined) {
    const resourceExists = checkResourceExists(scene, cameraAttributes);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `Camera attributes resource not found: ${cameraAttributes}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-worldenvironment-resources',
      });
    }
  }

  // world_environment.cpp:195-205 warns when `<slot>.is_valid()` and the world's
  // held resource for that slot is not this node's, and the world took it from
  // `get_first_node_in_group` (:75-105). That winner is not a live-tree fact:
  // the group is sorted in tree order (scene_tree.cpp:333-347 with
  // node.h:132-134), so it is the first WorldEnvironment in the file that joins
  // THAT group.
  //
  // Two consequences the old count-based form got wrong, both silent-in-Godot:
  // the winner itself compares equal and is never warned about, and the test is
  // `Ref` identity, so two nodes naming the SAME `ExtResource` share one instance
  // and neither warns.
  //
  // First means first node that JOINS the group, and `add_to_group` is gated on
  // that slot's own `is_valid()` — a leading WorldEnvironment carrying only
  // `camera_attributes` never enters the environment group, so the next one
  // along wins it and Godot says nothing about that one.
  //
  // The comparison is by resource ID, not by the raw text: `!=` on a `Ref` is
  // instance identity, and `SubResource("e")` and `SubResource( "e" )` are the
  // same instance — a spelling this file's own reference grammar accepts.
  //
  // Limitation, from the group spanning instanced sub-scenes: a WorldEnvironment
  // behind `instance=` can be the real first and is invisible here. The group key
  // also carries the World3D scenario id, so a WorldEnvironment inside a
  // SubViewport with `own_world_3d` is first in its own group; that scoping is
  // not modelled.
  for (const key of FIRST_WINS_SLOTS) {
    const held = heldResource(rawProps[key]);
    if (held === undefined) continue;
    const first = firstNodeOfType(scene.nodes, 'WorldEnvironment', (n) => declaresSlot(n, key));
    if (node === first) continue;
    const winningId = first && isValidProperties(first.properties)
      ? resourceRefId(heldResource(first.properties[key]))
      : undefined;
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

/**
 * WorldEnvironment semantic validation rule
 */
const worldEnvironmentValidationRule: LintRule = {
  meta: {
    name: 'valid-worldenvironment',
    description: 'Validates WorldEnvironment resource references and ensures only one WorldEnvironment exists',
    category: 'validation',
    applicableNodeTypes: ['WorldEnvironment'],
    emits: [
      { ruleName: 'worldenvironment-requires-environment', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      {
        ruleName: 'valid-worldenvironment-resources',
        severity: 'error',
        grounding: {
          kind: 'no-engine-counterpart',
          scope: 'dangling-reference',
          because: 'the environment, sky or camera_attributes id is undeclared in the file',
        },
      },
      {
        ruleName: 'single-worldenvironment',
        severity: 'warning',
        grounding: { kind: 'configuration-warning' },
      },
    ],
  },
  check: checkWorldEnvironment,
};

// Self-register the rule
ruleRegistry.register(worldEnvironmentValidationRule);

// Export for testing
export { worldEnvironmentValidationRule };
