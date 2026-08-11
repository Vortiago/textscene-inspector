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
import { checkResourceExists, isClearedResource } from '../../../linter/resourceChecker.js';
import { firstNodeOfType, isValidProperties } from '../../../linter/linterUtils.js';
import { parseResourceReference, findSubResource } from '../../../resources/SubResourceResolver.js';

/**
 * The resource a slot actually holds, or undefined when it holds none.
 *
 * A cleared slot (`environment = null`) is undefined here, exactly like an
 * absent key: `Ref::is_valid()` is false for both, so every question this file
 * asks Godot answers the same way for either. Reading the raw string as truthy
 * instead made `null` look like a held resource and got all four gates wrong at
 * once, including blaming the wrong node for a duplicate.
 */
function heldResource(raw: string | undefined): string | undefined {
  return raw === undefined || isClearedResource(raw) ? undefined : raw;
}

/** `environment.is_valid()`, the gate on joining the group (world_environment.cpp:39). */
function declaresEnvironment(node: TscnNode): boolean {
  return isValidProperties(node.properties) && heldResource(node.properties.environment) !== undefined;
}

/** `Ref` identity, spelled the way two references to one resource compare equal. */
function environmentId(raw: string | undefined): string | undefined {
  const held = heldResource(raw);
  if (!held) return undefined;
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

  // Godot's guard is a conjunction: `environment.is_null() &&
  // camera_attributes.is_null()` (world_environment.cpp:187). EITHER resource
  // gives the node a visible effect, so a camera_attributes-only
  // WorldEnvironment is a valid configuration the engine says nothing about.
  // Testing `environment` alone warned about exactly those scenes.
  if (heldResource(rawProps.environment) === undefined && heldResource(rawProps.camera_attributes) === undefined) {
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
  const environment = heldResource(rawProps.environment);
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
  const cameraAttributes = heldResource(rawProps.camera_attributes);
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

  // world_environment.cpp:195 warns when `environment.is_valid() &&
  // get_viewport()->find_world_3d()->get_environment() != environment`, and the
  // world's environment is whatever `_update_current_environment` (:76-80) took
  // from `get_first_node_in_group`. That winner is not a live-tree fact: the group
  // is sorted in tree order (scene_tree.cpp:333-347 with node.h:132-134), so it is
  // the first WorldEnvironment in the file.
  //
  // Two consequences the old count-based form got wrong, both silent-in-Godot:
  // the winner itself compares equal and is never warned about, and the test is
  // `Ref` identity, so two nodes naming the SAME `ExtResource` share one instance
  // and neither warns.
  //
  // First means first node that JOINS the group, and `add_to_group` is gated on
  // `environment.is_valid()` (:39-40) — a leading WorldEnvironment carrying only
  // `camera_attributes` never enters it, so the next one along is the winner and
  // Godot says nothing about it.
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
  const first = firstNodeOfType(scene.nodes, 'WorldEnvironment', declaresEnvironment);
  const winningId = first && isValidProperties(first.properties)
    ? environmentId(first.properties.environment)
    : undefined;
  if (
    heldResource(rawProps.environment) &&
    node !== first &&
    environmentId(rawProps.environment) !== winningId
  ) {
    diagnostics.push({
      severity: 'warning',
      message: `WorldEnvironment '${node.name}' is not the first in the scene, and its 'environment' is not the one the first declares, so Godot ignores it. Only the first Environment has an effect.`,
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
