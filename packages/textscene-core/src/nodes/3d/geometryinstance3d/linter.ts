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
 * Applicability is the GeometryInstance3D family, via `descendsFrom`.
 * RuleRegistry matches `applicableNodeTypes` by exact name, so an exact-match
 * rule here would fire only on a literal `GeometryInstance3D` node and stay
 * silent on MeshInstance3D, Sprite3D, Label3D and GPUParticles3D, which is
 * where the property is actually used.
 *
 * The CSG shapes are the one branch the check body subtracts, because the
 * warning does not reach them: `CSGShape3D::get_configuration_warnings` chains
 * to `Node::get_configuration_warnings` (csg_shape.cpp:978), skipping
 * GeometryInstance3D and VisualInstance3D both, so a CSGBox3D with an inverted
 * visibility range shows nothing in Godot's editor. Every other descendant that
 * overrides the method chains correctly (gpu_particles_3d.cpp:337,
 * cpu_particles_3d.cpp:215, soft_body_3d.cpp:402, sprite_3d.cpp:1470). The
 * MATCHER stays the whole family, the way the Viewport size rule keeps
 * SubViewport wired: the row's reach claim is about what the rule is wired to.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { descendsFrom } from '../../../godot/nodeBaseTypes.js';
import { isZeroApprox } from '../../../godot/index.js';
import { parseGodotFloat } from '../../../linter/validators/commonValidators.js';
import { ruleInt } from '../../../linter/validators/commonValidators.js';

const FADE_SELF = 1;
const FADE_DEPENDENCIES = 2;

/** `Math::is_zero_approx`, against the engine's own tolerance. */
function isZeroish(raw: string | undefined): boolean {
  if (raw === undefined) return true;
  const n = parseGodotFloat(raw);
  // Unreadable text is not a distance the fade can start from, so it reads as
  // the zero default. `nan` is a value the slot holds, and `is_zero_approx`
  // says false for it, so it must reach the comparison instead.
  return n === null || isZeroApprox(n);
}

function checkGeometryInstance3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  // A CSG shape's own override chains to `Node`, not to this class — see the
  // module docblock — so none of the three warnings is reachable on one.
  if (descendsFrom(node.type, 'CSGShape3D')) return diagnostics;

  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const props = node.properties as Record<string, string>;
  // `ruleInt`, not a string compare: the slot is an INT, so `1.0` and `01` are
  // both the 1 Godot stores, and comparing the raw text read them as "no fade"
  // on a value the validator beside this had already accepted.
  const fadeMode = ruleInt(props.visibility_range_fade_mode, 0);
  const fades = fadeMode === FADE_SELF || fadeMode === FADE_DEPENDENCIES;

  // scene/3d/visual_instance_3d.cpp: !is_zero_approx(visibility_range_end) &&
  // visibility_range_end <= visibility_range_begin
  if (!isZeroish(props.visibility_range_end)) {
    const end = parseGodotFloat(props.visibility_range_end!);
    const begin = parseGodotFloat(props.visibility_range_begin ?? '0');
    // No finiteness guard: `end <= begin` is false whenever either side is
    // `nan`, in JS exactly as in C++, and an infinite BEGIN is the engine's
    // own warning (visual_instance_3d.cpp:512) rather than an exclusion.
    if (end !== null && begin !== null && end <= begin) {
      diagnostics.push({
        severity: 'warning',
        message: `${node.type} visibility range's End distance (${end}) is set to a non-zero value, but is lower than or equal to the Begin distance (${begin}). This means the node will never be visible. Set End to 0 or to a value greater than Begin.`,
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
      message: `${node.type} is configured to fade in smoothly over distance, but 'visibility_range_begin_margin' is 0. Increase Visibility Range Begin Margin above 0 for the fade transition to be noticeable.`,
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
      message: `${node.type} is configured to fade out smoothly over distance, but 'visibility_range_end_margin' is 0. Increase Visibility Range End Margin above 0 for the fade transition to be noticeable.`,
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
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'GeometryInstance3D'),
    emits: [
      { ruleName: 'geometryinstance3d-visibility-range-end-before-begin', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: 'geometryinstance3d-visibility-range-begin-fade-without-margin', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: 'geometryinstance3d-visibility-range-end-fade-without-margin', severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkGeometryInstance3D,
};

ruleRegistry.register(geometryInstance3DValidationRule);

export { geometryInstance3DValidationRule };
