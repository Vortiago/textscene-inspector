/**
 * Semantic linter rules for WorldEnvironment
 *
 * Note: Format validation (resource reference format) is handled by linterParser.ts
 * during strict parsing. This file focuses on semantic validation that requires
 * full scene context (e.g., resource references exist, multiple WorldEnvironment nodes).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnScene } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists } from '../../../linter/resourceChecker.js';
import { firstNodeOfType, isValidProperties } from '../../../linter/linterUtils.js';
import { parseResourceReference, findSubResource } from '../../../resources/SubResourceResolver.js';

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
  if (!rawProps.environment && !rawProps.camera_attributes) {
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
  if (rawProps.environment) {
    if (!checkResourceExists(scene, rawProps.environment)) {
      diagnostics.push({
        severity: 'error',
        message: `Environment resource not found: ${rawProps.environment}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-worldenvironment-resources',
      });
    } else {
      // The Environment subresource may reference a Sky subresource; existence-check
      // it like the environment reference itself (the render parser reads sky too).
      const skyRef = getEnvironmentSkyReference(scene, rawProps.environment);
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
  if (rawProps.camera_attributes) {
    const resourceExists = checkResourceExists(scene, rawProps.camera_attributes);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `Camera attributes resource not found: ${rawProps.camera_attributes}`,
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
  // First means first WorldEnvironment, valid or not: the engine assigns
  // `first->environment` unconditionally, so a leading node with no environment
  // sets the world's to null and every later one with one does warn.
  //
  // Limitation, from the group spanning instanced sub-scenes: a WorldEnvironment
  // behind `instance=` can be the real first and is invisible here.
  const first = firstNodeOfType(scene.nodes, 'WorldEnvironment');
  const winningEnvironment =
    first && isValidProperties(first.properties) ? first.properties.environment : undefined;
  if (rawProps.environment && node !== first && rawProps.environment !== winningEnvironment) {
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
