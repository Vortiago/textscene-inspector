/**
 * Semantic linter rules for GeometryInstance3D.
 *
 * Format validation lives in linterParser.ts. This file covers the three
 * cross-field visibility-range checks GeometryInstance3D::get_configuration_warnings
 * performs in scene/3d/visual_instance_3d.cpp (all warning-severity, matching Godot's
 * own editor warnings, not hard errors):
 *
 *   if (!Math::is_zero_approx(visibility_range_end) && visibility_range_end <= visibility_range_begin) { ... }
 *   if ((fade_mode == SELF || fade_mode == DEPENDENCIES) && !is_zero_approx(visibility_range_begin) && is_zero_approx(visibility_range_begin_margin)) { ... }
 *   if ((fade_mode == SELF || fade_mode == DEPENDENCIES) && !is_zero_approx(visibility_range_end) && is_zero_approx(visibility_range_end_margin)) { ... }
 *
 * Two more warnings in that same function are deliberately NOT ported: both gate on
 * `OS::get_current_rendering_method() != "forward_plus"`, which depends on the
 * project's renderer setting (project.godot), information a single-.tscn-file linter
 * does not have — not an oversight.
 *
 * Applicability is exact-match (`applicableNodeTypes: ['GeometryInstance3D']`), same
 * default RuleRegistry semantics every other slice rule uses (see camera2d/linter.ts).
 * It does not yet reach concrete descendants (MeshInstance3D, Sprite3D, the CSG
 * shapes, …) because RuleRegistry's applicability is exact-match by design, unlike
 * ValidatorRegistry's base-walk — see RuleRegistry.ts. Reaching the whole family
 * would need either an analogous rule on each descendant slice (with its own
 * citation) or a shared predicate keyed off NODE_BASE_TYPES, which is out of this
 * slice's scope.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';

const FADE_SELF = '1';
const FADE_DEPENDENCIES = '2';

/** `Math::is_zero_approx` stand-in: good enough for a text-value linter, not a bit-exact port. */
function isZeroish(raw: string | undefined): boolean {
  if (raw === undefined) return true;
  const n = parseFloat(raw);
  return Number.isNaN(n) || Math.abs(n) < 1e-6;
}

function checkGeometryInstance3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const props = node.properties as Record<string, string>;
  const fadeMode = props.visibility_range_fade_mode;
  const fades = fadeMode === FADE_SELF || fadeMode === FADE_DEPENDENCIES;

  // scene/3d/visual_instance_3d.cpp: !is_zero_approx(visibility_range_end) &&
  // visibility_range_end <= visibility_range_begin
  if (!isZeroish(props.visibility_range_end)) {
    const end = parseFloat(props.visibility_range_end!);
    const begin = parseFloat(props.visibility_range_begin ?? '0');
    if (!Number.isNaN(end) && !Number.isNaN(begin) && end <= begin) {
      diagnostics.push({
        severity: 'warning',
        message: `GeometryInstance3D visibility range's End distance (${end}) is set to a non-zero value, but is lower than or equal to the Begin distance (${begin}). This means the node will never be visible. Set End to 0 or to a value greater than Begin.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'geometryinstance3d-visibility-range-end-before-begin',
      });
    }
  }

  // scene/3d/visual_instance_3d.cpp: fade_mode in {SELF, DEPENDENCIES} &&
  // !is_zero_approx(visibility_range_begin) && is_zero_approx(visibility_range_begin_margin)
  if (fades && !isZeroish(props.visibility_range_begin) && isZeroish(props.visibility_range_begin_margin)) {
    diagnostics.push({
      severity: 'warning',
      message: `GeometryInstance3D is configured to fade in smoothly over distance, but 'visibility_range_begin_margin' is 0. Increase Visibility Range Begin Margin above 0 for the fade transition to be noticeable.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'geometryinstance3d-visibility-range-begin-fade-without-margin',
    });
  }

  // scene/3d/visual_instance_3d.cpp: fade_mode in {SELF, DEPENDENCIES} &&
  // !is_zero_approx(visibility_range_end) && is_zero_approx(visibility_range_end_margin)
  if (fades && !isZeroish(props.visibility_range_end) && isZeroish(props.visibility_range_end_margin)) {
    diagnostics.push({
      severity: 'warning',
      message: `GeometryInstance3D is configured to fade out smoothly over distance, but 'visibility_range_end_margin' is 0. Increase Visibility Range End Margin above 0 for the fade transition to be noticeable.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'geometryinstance3d-visibility-range-end-fade-without-margin',
    });
  }

  return diagnostics;
}

const geometryInstance3DValidationRule: LintRule = {
  meta: {
    name: 'valid-geometryinstance3d-visibility-range',
    description:
      "Validates GeometryInstance3D's visibility-range cross-field consistency (End vs Begin distance, fade transitions needing a non-zero margin)",
    category: 'validation',
    applicableNodeTypes: ['GeometryInstance3D'],
    emits: [
      { ruleName: 'geometryinstance3d-visibility-range-end-before-begin', severity: 'warning' },
      { ruleName: 'geometryinstance3d-visibility-range-begin-fade-without-margin', severity: 'warning' },
      { ruleName: 'geometryinstance3d-visibility-range-end-fade-without-margin', severity: 'warning' },
    ],
  },
  check: checkGeometryInstance3D,
};

ruleRegistry.register(geometryInstance3DValidationRule);

export { geometryInstance3DValidationRule };
