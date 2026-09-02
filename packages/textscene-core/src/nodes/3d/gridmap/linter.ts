/**
 * Semantic linter rules for GridMap.
 *
 * Validates that the optional mesh_library reference resolves and that a
 * GridMap without one is flagged as a warning (it will render nothing).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { heldResource } from '../../../linter/resourceChecker.js';

function checkGridMap(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  const rawProps = node.properties as unknown as Record<string, string>;

  // If mesh_library is absent, flag as a warning — valid in Godot but the
  // GridMap will render nothing and likely isn't visible.
  if (heldResource(rawProps.mesh_library) === undefined) {
    diagnostics.push({
      severity: 'warning',
      message:
        'GridMap has no mesh_library. It will render nothing and is not visible.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'gridmap-requires-mesh-library',
    });
  }

  return diagnostics;
}

const gridMapValidationRule: LintRule = {
  meta: {
    name: 'valid-gridmap-resources',
    description: 'Flags a GridMap with no mesh_library as a warning',
    category: 'validation',
    emits: [
      {
        ruleName: 'gridmap-requires-mesh-library',
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'grid_map.cpp:676',
          unused: 'every cell is skipped while the library is null, so the map draws nothing',
        },
      },
    ],
    applicableNodeTypes: ['GridMap'],
  },
  check: checkGridMap,
};

ruleRegistry.register(gridMapValidationRule);

export { gridMapValidationRule };
