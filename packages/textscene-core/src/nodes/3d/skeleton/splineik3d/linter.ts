/**
 * Semantic linter rule for SplineIK3D: Godot's own configuration warning "Detecting settings with
 * no Path3D set!" (spline_ik_3d.cpp:109-118). `_process_ik` skips a setting whose NodePath resolves
 * to nothing (spline_ik_3d.cpp:313-316), so that chain is never posed. Godot omits the empty
 * default, so only `setting_count` counts the absences: a rule, not a validator (ADR-0032).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { indexedElements, nodePathLiteral } from '../../../../godot/index.js';
import { ruleCount } from '../../../../linter/validators/commonValidators.js';
import { unsatisfiedIndices } from '../../../../linter/reportedIndices.js';

/** `NodePath("")` and a bare `""`, the two spellings of the unset path. */
function isUnsetPath(raw: string): boolean {
  return nodePathLiteral(raw) === '' || raw === '""';
}

function checkSplineIK3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const properties = node.properties as unknown as Record<string, string>;

  // `_set_setting_count` refuses a negative count and the validator reports it. A count that is
  // absent, unparseable or negative allocates nothing, and Godot's own loop over `sp_settings` runs
  // zero times.
  const count = ruleCount(properties['setting_count'] ?? '');
  if (count === null || count <= 0) return [];

  // Grouped by the setting `_set` resolves each key to, not by the index text: `_set` reads the
  // index with a bare `path.get_slicec('/', 1).to_int()` and no validity gate
  // (spline_ik_3d.cpp:37), so `settings/00/path_3d` sets setting 0's path.
  const settings = indexedElements(properties, 'settings/', 'to_int');
  const posed = new Set<number>();
  for (const [index, leaves] of settings) {
    if (index >= count) continue;
    const path = leaves.get('path_3d');
    if (path !== undefined && !isUnsetPath(path.trim())) posed.add(index);
  }
  // Capped at both ends: `setting_count` has no ceiling, so the walk is bounded as well as the
  // message. See `reportedIndices.ts`.
  const { listed: missing, total } = unsatisfiedIndices(count, posed);
  const omitted = total - missing.length;
  const diagnostics: Diagnostic[] = missing.map((index) => ({
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
