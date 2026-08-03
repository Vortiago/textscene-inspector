/**
 * Semantic linter rules for GridMap.
 *
 * Validates that the optional mesh_library reference resolves and that a
 * GridMap without one is flagged as a warning (it will render nothing).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists } from '../../../linter/resourceChecker.js';

function checkGridMap(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;


  const rawProps = node.properties as unknown as Record<string, string>;

  // If mesh_library is absent, flag as a warning — valid in Godot but the
  // GridMap will render nothing and likely isn't visible.
  if (!rawProps.mesh_library) {
    diagnostics.push({
      severity: 'warning',
      message:
        'GridMap has no mesh_library. It will render nothing and is not visible.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'gridmap-requires-mesh-library',
    });
  } else if (!checkResourceExists(scene, rawProps.mesh_library)) {
    diagnostics.push({
      severity: 'error',
      message: `MeshLibrary resource not found: ${rawProps.mesh_library} (mesh_library)`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'valid-gridmap-resources',
    });
  }

  return diagnostics;
}

const gridMapValidationRule: LintRule = {
  meta: {
    name: 'valid-gridmap-resources',
    description:
      'Validates GridMap mesh_library reference resolves and flags missing mesh_library as a warning',
    category: 'validation',
    emits: [
      { ruleName: 'gridmap-requires-mesh-library', severity: 'warning' },
      { ruleName: 'valid-gridmap-resources', severity: 'error' },
    ],
    applicableNodeTypes: ['GridMap'],
  },
  check: checkGridMap,
};

ruleRegistry.register(gridMapValidationRule);

export { gridMapValidationRule };
