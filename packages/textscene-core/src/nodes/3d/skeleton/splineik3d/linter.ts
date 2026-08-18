/**
 * Semantic linter rule for SplineIK3D, from Godot's own configuration warning,
 * `SplineIK3D::get_configuration_warnings()` (spline_ik_3d.cpp:109-118):
 *
 *     if (sp_settings[i]->path_3d.is_empty()) {
 *         warnings.push_back(RTR("Detecting settings with no Path3D set! "
 *                                "SplineIK3D must have a Path3D to work."));
 *
 * It is not cosmetic. `_process_ik` resolves the NodePath and abandons the
 * setting when nothing comes back (spline_ik_3d.cpp:313-316), before the curve
 * is even read, so a path-less setting poses its bones exactly never: the
 * modifier is inert for that chain while looking fully configured.
 *
 * Why this cannot be a validator: `path_3d` is empty by DEFAULT, so Godot omits
 * the key entirely when saving. The defect is an ABSENCE, and only the sibling
 * `setting_count` says how many absences to look for, which no per-property
 * validator can see (ADR-0032 leaves a bound against a sibling count to a
 * semantic rule).
 *
 * A bare `[node type="SplineIK3D"]` is silent: with no settings allocated there
 * is nothing for a path to be missing from, and Godot's own loop over
 * `sp_settings` runs zero times.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';
import { nodePathLiteral } from '../../../../godot/index.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';
import { cappedIndices, omittedIndexCount } from '../../../../linter/reportedIndices.js';

/** `NodePath("")` and a bare `""`, the two spellings of the unset path. */
function isUnsetPath(raw: string): boolean {
  return nodePathLiteral(raw) === '' || raw === '""';
}

function checkSplineIK3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const properties = node.properties as unknown as Record<string, string>;

  // `_set_setting_count` refuses a negative count and the validator reports it,
  // so a count that is absent, unparseable or negative allocates nothing here.
  const count = ruleInt(properties['setting_count'] ?? '');
  if (count === null || count <= 0) return [];

  const missing: number[] = [];
  for (let index = 0; index < count; index++) {
    const path = properties[`settings/${index}/path_3d`];
    if (path !== undefined && !isUnsetPath(path.trim())) continue;
    missing.push(index);
  }
  // Capped: `setting_count` has no ceiling, and one diagnostic per index threw
  // the whole lint away past ~130,000 of them. See `reportedIndices.ts`.
  const omitted = omittedIndexCount(missing);
  const diagnostics: Diagnostic[] = cappedIndices(missing).map((index) => ({
    severity: 'warning' as const,
    message: `SplineIK3D '${node.name}' setting ${index} has no Path3D. Godot resolves 'settings/${index}/path_3d' before it reads the curve and skips the setting when nothing comes back, so this chain of bones is never posed.`,
    nodeName: node.name,
    nodeType: node.type,
    ruleName: 'splineik3d-setting-without-path-3d',
  }));
  if (omitted > 0) {
    diagnostics.push({
      severity: 'warning',
      message: `SplineIK3D '${node.name}' has ${omitted.toLocaleString('en-US')} further settings with no Path3D, not listed individually.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'splineik3d-setting-without-path-3d',
    });
  }
  return diagnostics;
}

const splineIK3DPathRule: LintRule = {
  meta: {
    name: 'valid-splineik3d-path-3d',
    description:
      'Warns when a SplineIK3D setting names no Path3D, the configuration Godot itself flags and then skips',
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'SplineIK3D'),
    emits: [{ ruleName: 'splineik3d-setting-without-path-3d', severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkSplineIK3D,
};

ruleRegistry.register(splineIK3DPathRule);

export { splineIK3DPathRule };
