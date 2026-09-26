/**
 * Semantic linter rules for Path3D: the checks that need the whole scene, such as whether the
 * curve resource exists. linterParser.ts checks the reference format. There is no "no PathFollow3D
 * children" check: `path_3d.h`/`path_3d.cpp` declare `get_configuration_warnings()` only on
 * `PathFollow3D`, and a CSGPolygon3D in PATH mode or a SplineIK3D can consume a bare Path3D.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { heldResource } from '../../../linter/resourceChecker.js';
import { findSubResourceOfType } from '../../../resources/SubResourceResolver.js';
import {
  CURVE3D_DATA,
  bezierDataRefusal,
  bezierPointsLiteral,
  type BezierDataRefusal,
} from '../../../resources/curves/shared/bezierData.js';
import { packedArrayForms, subResourceRefAnywhere } from '../../../godot/index.js';
import { dictPackedField, packedFloatCount } from '../../../godot/packedArrayFields.js';

// "tilts" converts through the Variant (curve.cpp:2291), so it takes the three
// spellings `packedArrayForms` lists.
const TILTS_RE = dictPackedField('tilts', 'PackedFloat32Array');
const TILTS_FORMS = packedArrayForms('PackedFloat32Array');

function checkPath3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  const rawProps = node.properties as unknown as Record<string, string>;

  // A curve-less Path3D is valid (the curve can be assigned at runtime) but
  // draws nothing until one is set.
  const curve = heldResource(rawProps.curve);
  if (curve === undefined) {
    diagnostics.push({
      severity: 'info',
      message: `Path3D '${node.name}' is missing required property 'curve'. A Path3D without a Curve3D resource is useless.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'path3d-requires-curve',
    });
  } else {
    diagnostics.push(...checkCurve3DData(context, curve));
  }

  return diagnostics;
}

/**
 * Validate the referenced Curve3D's `_data` against what Godot loads. `Curve3D::_set_data`
 * (`scene/resources/curve.cpp:2278-2299`) fails on a missing `points` or `tilts` key, and on a
 * `points` length that is not a multiple of three Vector3s (in, out, position). The curve then
 * loads with zero points, so the Path3D and any CSGPolygon3D along it draw nothing: an error.
 */
function checkCurve3DData(context: RuleContext, curveRef: string): Diagnostic[] {
  const { node, scene } = context;
  const id = subResourceRefAnywhere(curveRef);
  if (id === null) return [];

  const data = findSubResourceOfType(scene.internalResources ?? [], id, 'Curve3D')?.data._data;
  if (typeof data !== 'string') return [];

  const problem = refusalProblem(bezierDataRefusal(data, CURVE3D_DATA)) ?? shortTiltsProblem(data);
  if (problem === null) return [];
  return [
    {
      severity: 'error',
      message: `Path3D '${node.name}': ${problem}`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'curve3d-loadable',
    },
  ];
}

function refusalProblem(refusal: BezierDataRefusal | null): string | null {
  if (refusal === null) return null;
  if (refusal.kind === 'partial-point') {
    return (
      `its Curve3D "points" holds ${refusal.floats} floats. Godot needs a whole number of control ` +
      'points at nine floats each (in / out / position) and rejects the resource otherwise.'
    );
  }
  if (refusal.key === 'points') {
    return 'its Curve3D has no "points" in `_data`. Godot loads the curve with zero points and the path draws nothing.';
  }
  return (
    `its Curve3D has no "${refusal.key}" in \`_data\`. Godot requires both "points" and "tilts" ` +
    '(curve.cpp:2279-2280) and loads the curve with zero points without it, so the path ' +
    'silently disappears even though the scene looks valid.'
  );
}

/**
 * Too few only. `Curve3D::_set_data`'s fill loop is bounded by `points.size()`
 * (curve.cpp:2294) and indexes `rt[i]` inside it, so a short `tilts` reads past the end
 * while a long one leaves its extra values untouched and loads.
 */
function shortTiltsProblem(data: string): string | null {
  const tiltsLiteral = TILTS_RE.exec(data)?.[1];
  const pointsLiteral = bezierPointsLiteral(data, CURVE3D_DATA);
  if (tiltsLiteral === undefined || pointsLiteral === null) return null;
  const tilts = packedFloatCount(TILTS_FORMS, tiltsLiteral, 1);
  const points =
    packedFloatCount(CURVE3D_DATA.pointsForms, pointsLiteral, CURVE3D_DATA.vectorSize) /
    CURVE3D_DATA.floatsPerPoint;
  if (tilts >= points) return null;
  return (
    `its Curve3D has ${tilts} tilt values for ${points} control points. Godot indexes ` +
    'tilts by point and reads past the end when there are too few.'
  );
}

const path3DValidationRule: LintRule = {
  meta: {
    name: 'valid-path3d',
    description: 'Validates Path3D curve resource references',
    category: 'validation',
    applicableNodeTypes: ['Path3D'],
    emits: [
      {
        ruleName: 'path3d-requires-curve',
        severity: 'info',
        grounding: {
          kind: 'engine-inert',
          at: 'path_3d.cpp:275',
          unused: 'a PathFollow3D on this path returns before moving, so nothing follows it',
        },
      },
      {
        ruleName: 'curve3d-loadable',
        severity: 'error',
        grounding: { kind: 'engine', at: 'curve.cpp:2279' },
      },
    ],
  },
  check: checkPath3D,
};

ruleRegistry.register(path3DValidationRule);

export { path3DValidationRule };
