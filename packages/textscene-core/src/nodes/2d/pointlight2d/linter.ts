/**
 * PointLight2D semantic rules.
 *
 * Format validation lives in `linterParser.ts`; this file is for what only the
 * whole node says. Two things live here.
 *
 * `PointLight2D::get_configuration_warnings` (light_2d.cpp:431-439) warns in
 * Godot's own editor when `texture` is unset, because the light then has no
 * shape to draw. Absence is Godot's default serialised form for an unset
 * `Ref`, so this keys on the property being MISSING, not on any value — a
 * scene that never authors `texture` is legal input, just one the engine
 * itself flags.
 *
 * The other is a range window whose minimum is above its maximum.
 *
 * Godot tests both windows inclusively (`_record_item_commands` in
 * `drivers/gles3/rasterizer_canvas_gles3.cpp` for z, `_draw_viewport`'s
 * per-canvas loop in `servers/rendering/renderer_viewport.cpp` for the layer)
 * and never swaps an inverted pair — `Light2D`'s four setters assign and
 * forward, nothing more. So `min > max` is an EMPTY interval: the light stays
 * enabled, still costs its own accumulation pass, and reaches nothing at all.
 * That is an authoring mistake this previewer flags, not a complaint Godot's
 * own editor makes, so it warns rather than errors.
 *
 * The comparison uses Godot's defaults for whichever half is absent, because
 * `range_z_max = -2000` alone — already empty against the default `range_z_min`
 * of -1024 — is the commonest way to write the mistake.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { POINT_LIGHT_2D_RANGE_DEFAULTS } from './types.js';
import { resourceSlotIsEmpty } from '../../../linter/resourceChecker.js';
import { parseGodotInt } from '../../../linter/validators/commonValidators.js';

const WINDOWS = [
  {
    min: 'range_z_min',
    max: 'range_z_max',
    minDefault: POINT_LIGHT_2D_RANGE_DEFAULTS.zMin,
    maxDefault: POINT_LIGHT_2D_RANGE_DEFAULTS.zMax,
    ruleName: 'pointlight2d-inverted-z-range',
    reaches: 'no item at any z_index',
  },
  {
    min: 'range_layer_min',
    max: 'range_layer_max',
    minDefault: POINT_LIGHT_2D_RANGE_DEFAULTS.layerMin,
    maxDefault: POINT_LIGHT_2D_RANGE_DEFAULTS.layerMax,
    ruleName: 'pointlight2d-inverted-layer-range',
    reaches: 'no canvas at any layer',
  },
] as const;

/**
 * The authored value, or the default when absent. `null` when it is authored but
 * unparseable — the validators already report that, and guessing a number for it
 * would invent a second diagnostic from the same typo.
 */
function bound(raw: string | undefined, fallback: number): number | null {
  if (raw === undefined) return fallback;
  return parseGodotInt(raw);
}

function checkPointLight2D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];
  const props = node.properties as Record<string, string>;

  const diagnostics: Diagnostic[] = [];

  // light_2d.cpp:431-439: PointLight2D::get_configuration_warnings pushes this
  // exact message when `texture` is null. A `.tscn` that never authors the key
  // IS that null default, so absence is the trigger.
  if (resourceSlotIsEmpty(props.texture)) {
    diagnostics.push({
      severity: 'warning',
      message:
        "PointLight2D has no 'texture': Godot's own editor warning is " +
        '"A texture with the shape of the light must be supplied to the ' +
        '\'Texture\' property."',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'pointlight2d-requires-texture',
    });
  }

  for (const window of WINDOWS) {
    const min = bound(props[window.min], window.minDefault);
    const max = bound(props[window.max], window.maxDefault);
    if (min === null || max === null || min <= max) continue;
    diagnostics.push({
      severity: 'warning',
      message:
        `PointLight2D '${window.min}' (${min}) is above '${window.max}' (${max}). ` +
        `Godot tests the window inclusively and does not swap the bounds, so this ` +
        `light reaches ${window.reaches}.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: window.ruleName,
    });
  }
  return diagnostics;
}

const pointLight2DValidationRule: LintRule = {
  meta: {
    name: 'valid-pointlight2d-ranges',
    description:
      "Validates PointLight2D has a texture, and that its z and layer range windows don't invert",
    category: 'validation',
    applicableNodeTypes: ['PointLight2D'],
    emits: [
      { ruleName: 'pointlight2d-requires-texture', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      {
        ruleName: 'pointlight2d-inverted-z-range',
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'rasterizer_canvas_gles3.cpp:849',
          unused: 'the inclusive z test can never pass, so the light reaches no item',
        },
      },
      {
        ruleName: 'pointlight2d-inverted-layer-range',
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'renderer_viewport.cpp:672',
          unused: 'the inclusive layer test can never pass, so the light reaches no canvas',
        },
      },
    ],
  },
  check: checkPointLight2D,
};

ruleRegistry.register(pointLight2DValidationRule);

export { pointLight2DValidationRule };
