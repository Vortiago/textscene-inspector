/**
 * Semantic linter rules for Path3D
 *
 * Note: Format validation (curve resource reference format) is handled by linterParser.ts
 * during strict parsing. This file focuses on semantic validation that requires
 * full scene context (e.g., curve resource exists).
 *
 * No "no PathFollow3D children" check: `path_3d.h`/`path_3d.cpp` declare a
 * `get_configuration_warnings()` override only on `PathFollow3D`, never on
 * `Path3D` itself — Godot raises no warning for a followerless Path3D. A
 * CSGPolygon3D in PATH mode extruding along a `path_node`, or a SplineIK3D
 * naming one through its indexed settings, are both first-class consumers
 * that need no PathFollow3D at all.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnInternalResource } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { heldResource } from '../../../linter/resourceChecker.js';
import {
  packedArrayBody,
  packedArrayForms,
  splitTopLevel,
  subResourceRefAnywhere,
} from '../../../godot/index.js';
import { dictPackedField } from '../../../godot/packedArrayFields.js';

// Both fields convert through the Variant (curve.cpp:2282, :2291), so each takes
// the three spellings `packedArrayForms` lists.
const POINTS_RE = dictPackedField('points', 'PackedVector3Array');
const TILTS_RE = dictPackedField('tilts', 'PackedFloat32Array');
const POINTS_FORMS = packedArrayForms('PackedVector3Array');
const TILTS_FORMS = packedArrayForms('PackedFloat32Array');

/**
 * How many floats a field's value holds: the packed constructor lists them
 * flat, the two array spellings hold one `groupSize`-float element each.
 */
function floatCount(forms: readonly RegExp[], value: string, groupSize: number): number {
  const matched = packedArrayBody(forms, value);
  if (!matched || matched.body === '') return 0;
  const parts = matched.flat ? matched.body.split(',') : splitTopLevel(matched.body);
  const count = parts.filter((s) => s.trim() !== '').length;
  return matched.flat ? count : count * groupSize;
}

/**
 * Validate Path3D semantic rules
 */
function checkPath3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  // Access raw properties from the node (Record<string, string>)
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
 * Validate the referenced Curve3D's `_data` against what Godot will actually load.
 *
 * `Curve3D::_set_data` (`scene/resources/curve.cpp:2278-2299`) hard-fails on a missing
 * `points` or `tilts` key, and on a `points` array whose length is not a multiple of
 * three Vector3s (in / out / position per control point). A curve that fails to load
 * comes back with ZERO points, so the Path3D silently draws nothing and any CSGPolygon3D
 * sweeping along it produces no geometry at all.
 *
 * This is worth a rule because it is invisible to everything else we have: our lenient
 * parser reads such a curve happily, the strict parser sees well-formed TSCN, and the
 * scene renders here while rendering EMPTY in Godot. That exact mistake was made while
 * authoring a swept-path scene and only surfaced from a pixel comparison
 * against a real Godot render.
 *
 * Errors rather than warnings: Godot refuses to load the resource, so this is not an
 * advisory style question.
 */
function checkCurve3DData(context: RuleContext, curveRef: string): Diagnostic[] {
  const { node, scene } = context;
  const id = subResourceRefAnywhere(curveRef);
  if (id === null) return [];

  const resource = scene.internalResources?.find(
    (r: TscnInternalResource) => r.id === id && r.type === 'Curve3D'
  );
  if (!resource) return [];

  const data = (resource.data as Record<string, string>)['_data'];
  if (typeof data !== 'string') return [];

  const problem = (message: string): Diagnostic => ({
    severity: 'error',
    message: `Path3D '${node.name}': ${message}`,
    nodeName: node.name,
    nodeType: node.type,
    ruleName: 'curve3d-loadable',
  });

  const pointsLiteral = POINTS_RE.exec(data);
  if (!pointsLiteral) {
    return [problem("its Curve3D has no \"points\" in `_data`; Godot loads the curve with zero points and the path draws nothing.")];
  }
  if (!/"tilts"\s*:/.test(data)) {
    return [
      problem(
        'its Curve3D has no "tilts" in `_data`. Godot requires both "points" and "tilts" ' +
          '(curve.cpp:2279-2280) and loads the curve with zero points without it, so the path ' +
          'silently disappears even though the scene looks valid.'
      ),
    ];
  }

  const floats = floatCount(POINTS_FORMS, pointsLiteral[1]!, 3);
  const vector3s = floats / 3;
  if (floats % 3 !== 0 || vector3s % 3 !== 0) {
    return [
      problem(
        `its Curve3D "points" holds ${floats} floats; Godot needs a whole number of control ` +
          'points at nine floats each (in / out / position) and rejects the resource otherwise.'
      ),
    ];
  }

  const tiltsLiteral = TILTS_RE.exec(data);
  if (tiltsLiteral) {
    const tilts = floatCount(TILTS_FORMS, tiltsLiteral[1]!, 1);
    const expected = vector3s / 3;
    // Too FEW only. `Curve3D::_set_data`'s fill loop is bounded by
    // `points.size()` (curve.cpp:2294) and indexes `rt[i]` inside it, so a short
    // `tilts` reads past the end of the array while a long one simply leaves its
    // extra values untouched — that scene loads, and reporting it was an error
    // on a file Godot opens.
    if (tilts < expected) {
      return [
        problem(
          `its Curve3D has ${tilts} tilt values for ${expected} control points; Godot indexes ` +
            'tilts by point and reads past the end when there are too few.'
        ),
      ];
    }
  }

  return [];
}

/**
 * Path3D semantic validation rule
 */
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

// Self-register the rule
ruleRegistry.register(path3DValidationRule);

// Export for testing
export { path3DValidationRule };
