/**
 * Path2D semantic rules. A missing `curve` is advisory: a script often assigns
 * it at runtime. No followerless-Path2D check: only `PathFollow2D` overrides
 * `get_configuration_warnings()` in `path_2d.h`/`path_2d.cpp`.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists, heldResource } from '../../../linter/resourceChecker.js';

function checkPath2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  const rawProps = node.properties as unknown as Record<string, string>;

  const curve = heldResource(rawProps.curve);
  if (curve === undefined) {
    // A script commonly assigns the curve at runtime, so stay silent then. The
    // script must load: a raw `'null'` is truthy, and an undeclared reference
    // loads nothing.
    const script = heldResource(rawProps.script);
    if (script === undefined || !checkResourceExists(scene, script)) {
      diagnostics.push({
        severity: 'info',
        message: `Path2D '${node.name}' has no 'curve'. It will draw nothing until a Curve2D is assigned (often set at runtime via script).`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'path2d-missing-curve',
      });
    }
  }

  return diagnostics;
}

const path2DValidationRule: LintRule = {
  meta: {
    name: 'valid-path2d',
    description: 'Validates Path2D curve resource references',
    category: 'validation',
    applicableNodeTypes: ['Path2D'],
    emits: [
      {
        ruleName: 'path2d-missing-curve',
        severity: 'info',
        grounding: {
          kind: 'engine-inert',
          at: 'path_2d.cpp:161',
          unused: 'the debug pass has already cleared the mesh and returns without refilling it',
        },
      },
    ],
  },
  check: checkPath2D,
};

ruleRegistry.register(path2DValidationRule);

export { path2DValidationRule };
