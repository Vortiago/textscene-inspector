/**
 * Path2D semantic rules. A missing `curve` is advisory: a script often assigns
 * it at runtime. A curve whose `_data` Godot refuses is an error. No
 * followerless-Path2D check: only `PathFollow2D` overrides
 * `get_configuration_warnings()` in `path_2d.h`/`path_2d.cpp`.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists, heldResource } from '../../../linter/resourceChecker.js';
import { findSubResourceOfType } from '../../../resources/SubResourceResolver.js';
import { CURVE2D_DATA, bezierDataRefusal } from '../../../resources/curves/shared/bezierData.js';
import { subResourceRefAnywhere } from '../../../godot/index.js';

function checkPath2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  const rawProps = node.properties as unknown as Record<string, string>;

  const curve = heldResource(rawProps.curve);
  if (curve !== undefined) {
    diagnostics.push(...checkCurve2DData(context, curve));
  } else {
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

/**
 * Validate the referenced Curve2D's `_data` against what Godot loads. `Curve2D::_set_data`
 * (curve.cpp:1238-1259) fails on a missing `points` key, and on a `points` length that is
 * not a multiple of three Vector2s (in, out, position). The curve then loads with zero
 * points, so the path draws nothing and a PathFollow2D on it never moves: an error.
 */
function checkCurve2DData(context: RuleContext, curveRef: string): Diagnostic[] {
  const { node, scene } = context;
  const id = subResourceRefAnywhere(curveRef);
  if (id === null) return [];

  const data = findSubResourceOfType(scene.internalResources ?? [], id, 'Curve2D')?.data._data;
  if (typeof data !== 'string') return [];

  const refusal = bezierDataRefusal(data, CURVE2D_DATA);
  if (refusal === null) return [];
  const problem =
    refusal.kind === 'missing-key'
      ? `its Curve2D has no "${refusal.key}" in \`_data\`. Godot requires it (curve.cpp:1239) ` +
        'and loads the curve with zero points, so the path draws nothing.'
      : `its Curve2D "points" holds ${refusal.floats} floats. Godot needs a whole number of ` +
        'control points at six floats each (in / out / position) and loads the curve with zero ' +
        'points otherwise.';
  return [
    {
      severity: 'error',
      message: `Path2D '${node.name}': ${problem}`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'curve2d-loadable',
    },
  ];
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
      {
        ruleName: 'curve2d-loadable',
        severity: 'error',
        grounding: { kind: 'engine', at: 'curve.cpp:1239' },
      },
    ],
  },
  check: checkPath2D,
};

ruleRegistry.register(path2DValidationRule);

export { path2DValidationRule };
