/**
 * GridMap semantic rules: the optional mesh_library reference resolves, and a
 * GridMap without one is reported, since it is legal and renders nothing.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { heldResource } from '../../../linter/resourceChecker.js';
import { armEmits, groundedArm, reportArm, type RuleArms } from '../../../linter/ruleArms.js';

const arms = {
  missingMeshLibrary: groundedArm('gridmap-requires-mesh-library', {
    kind: 'engine-inert',
    at: 'grid_map.cpp:676',
    unused: 'every cell is skipped while the library is null, so the map draws nothing',
  }),
} as const satisfies RuleArms<string>;

function checkGridMap(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  const rawProps = node.rawProperties;

  // An absent mesh_library is valid in Godot, but the GridMap renders nothing.
  if (heldResource(rawProps.mesh_library) === undefined) {
    reportArm(
      diagnostics,
      arms.missingMeshLibrary,
      node,
      'GridMap has no mesh_library. It will render nothing and is not visible.'
    );
  }

  return diagnostics;
}

const gridMapValidationRule: LintRule = {
  meta: {
    name: 'valid-gridmap-resources',
    description: 'Flags a GridMap with no mesh_library, which renders nothing',
    category: 'validation',
    emits: armEmits(arms),
    applicableNodeTypes: ['GridMap'],
  },
  check: checkGridMap,
};

ruleRegistry.register(gridMapValidationRule);

export { gridMapValidationRule };
