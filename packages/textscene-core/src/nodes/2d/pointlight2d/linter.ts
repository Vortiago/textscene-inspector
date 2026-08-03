/**
 * PointLight2D semantic rules.
 *
 * Format validation lives in `linterParser.ts`; this file is for what only the
 * whole node says. There is exactly one such thing here: a range window whose
 * minimum is above its maximum.
 *
 * Godot tests both windows inclusively (`_record_item_commands` in
 * `drivers/gles3/rasterizer_canvas_gles3.cpp` for z, `_draw_viewport`'s
 * per-canvas loop in `servers/rendering/renderer_viewport.cpp` for the layer)
 * and never swaps an inverted pair — `Light2D`'s four setters assign and
 * forward, nothing more. So `min > max` is an EMPTY interval: the light stays
 * enabled, still costs its own accumulation pass, and reaches nothing at all.
 * That is authoring error rather than a malformed file, so it warns.
 *
 * The comparison uses Godot's defaults for whichever half is absent, because
 * `range_z_max = -2000` alone — already empty against the default `range_z_min`
 * of -1024 — is the commonest way to write the mistake.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { POINT_LIGHT_2D_RANGE_DEFAULTS } from './types.js';

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
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function checkPointLight2D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];
  const props = node.properties as Record<string, string>;

  const diagnostics: Diagnostic[] = [];
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
      "Validates PointLight2D's z and layer range windows, which reach nothing when inverted",
    category: 'validation',
    applicableNodeTypes: ['PointLight2D'],
    emits: [
      { ruleName: 'pointlight2d-inverted-z-range', severity: 'warning' },
      { ruleName: 'pointlight2d-inverted-layer-range', severity: 'warning' },
    ],
  },
  check: checkPointLight2D,
};

ruleRegistry.register(pointLight2DValidationRule);

export { pointLight2DValidationRule };
