/**
 * Path2D semantic rules. A missing `curve` is advisory: a script often assigns
 * it at runtime. A curve whose `_data` Godot refuses is an error. No
 * followerless-Path2D check: only `PathFollow2D` overrides
 * `get_configuration_warnings()` in `path_2d.h`/`path_2d.cpp`.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { armDiagnostic, armEmits, groundedArm, reportArm, type RuleArms } from '../../../linter/ruleArms.js';
import { checkResourceExists, heldResource } from '../../../linter/resourceChecker.js';
import { findSubResourceOfType } from '../../../resources/SubResourceResolver.js';
import {
  CURVE2D_DATA,
  bezierRefusalProblem,
  readBezierData,
} from '../../../resources/curves/shared/bezierData.js';
import { subResourceRefAnywhere } from '../../../godot/index.js';

const arms = {
  missingCurve: groundedArm('path2d-missing-curve', {
    kind: 'engine-inert',
    at: 'path_2d.cpp:161',
    unused: 'the debug pass has already cleared the mesh and returns without refilling it',
  }),
  unloadableCurve: {
    severity: 'error',
    ruleName: 'curve2d-loadable',
    grounding: { kind: 'engine', at: 'curve.cpp:1239' },
  },
} as const satisfies RuleArms<string>;

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
      reportArm(
        diagnostics,
        arms.missingCurve,
        node,
        `Path2D '${node.name}' has no 'curve'. It will draw nothing until a Curve2D is assigned (often set at runtime via script).`
      );
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

  const curve = findSubResourceOfType(scene.internalResources ?? [], id, CURVE2D_DATA.className);
  const data = curve?.data._data;
  if (typeof data !== 'string') return [];

  const { refusal } = readBezierData(data, CURVE2D_DATA);
  if (refusal === null) return [];
  return [
    armDiagnostic(
      arms.unloadableCurve,
      node,
      `Path2D '${node.name}': ${bezierRefusalProblem(refusal, CURVE2D_DATA)}`
    ),
  ];
}

const path2DValidationRule: LintRule = {
  meta: {
    name: 'valid-path2d',
    description: 'Validates Path2D curve resource references',
    category: 'validation',
    applicableNodeTypes: ['Path2D'],
    emits: armEmits(arms),
  },
  check: checkPath2D,
};

ruleRegistry.register(path2DValidationRule);

export { path2DValidationRule };
