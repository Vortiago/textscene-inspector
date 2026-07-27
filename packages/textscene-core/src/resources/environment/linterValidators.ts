/**
 * Environment linter validators - validates property formats and constraints
 */

import { validatorRegistry } from '../../linter/ValidatorRegistry';
import type { PropertyValidator } from '../../linter/ValidatorRegistry';
import { COLOR_RE } from '../../parser/vectors.js';
import { v } from '../../linter/validators/index.js';

/**
 * Validate boolean properties
 */
const validateBoolean: PropertyValidator = (key, value, line) => {
  if (value !== 'true' && value !== 'false') {
    return {
      severity: 'error',
      message: `Property "${key}" must be "true" or "false", got: ${value}`,
      line,
      column: 0,
      code: 'INVALID_BOOLEAN',
    };
  }
  return null;
};

/**
 * Validate Color format: Color(r, g, b, a)
 */
const validateColor: PropertyValidator = (key, value, line) => {
  if (!COLOR_RE.test(value)) {
    return {
      severity: 'error',
      message: `Property "${key}" must be a Color in format Color(r, g, b, a), got: ${value}`,
      line,
      column: 0,
      code: 'INVALID_COLOR_FORMAT',
    };
  }
  return null;
};

/**
 * Validate number >= 0
 */
const validateNonNegativeNumber = (): PropertyValidator => {
  return (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
      return {
        severity: 'error',
        message: `Property "${key}" must be a number >= 0, got: "${value}"`,
        line,
        column: 0,
        code: 'INVALID_NUMBER',
      };
    }
    return null;
  };
};

/**
 * Validate an integer enum in [min, max]. Message/code follow the existing
 * background_mode wording so the whole file stays self-consistent.
 */
const validateEnumInt = (name: string, min: number, max: number): PropertyValidator => {
  return (_key, value, line) => {
    const mode = parseInt(value, 10);
    if (isNaN(mode) || mode < min || mode > max) {
      return {
        severity: 'error',
        message: `Property '${name}' must be an integer ${min}-${max}, got: "${value}"`,
        line,
        column: 0,
        code: `INVALID_${name.toUpperCase()}`,
      };
    }
    return null;
  };
};

// Register validators for Environment properties
validatorRegistry.registerAll('Environment', {
  background_mode: validateEnumInt('background_mode', 0, 5),
  background_color: validateColor,
  background_energy_multiplier: validateNonNegativeNumber(),
  sky: v.resourceReference('sky'),

  // Ambient lighting — read by the render parser, so lint it too (parity).
  ambient_light_source: validateEnumInt('ambient_light_source', 0, 3),
  ambient_light_color: validateColor,
  ambient_light_energy: validateNonNegativeNumber(),

  // Screen-space fog — read by the render parser (feeds the scene fog), so lint it.
  fog_enabled: validateBoolean,
  fog_density: validateNonNegativeNumber(),
  fog_light_color: validateColor,
  fog_mode: validateEnumInt('fog_mode', 0, 1),

  // Tonemapping — parsed but not yet rendered; validate so it isn't silently ignored.
  tonemap_mode: validateEnumInt('tonemap_mode', 0, 4),
  tonemap_white: validateNonNegativeNumber(),
  tonemap_exposure: validateNonNegativeNumber(),

  volumetric_fog_enabled: validateBoolean,
  volumetric_fog_density: validateNonNegativeNumber(),
  volumetric_fog_albedo: validateColor,
  volumetric_fog_emission: validateColor,

  adjustment_enabled: validateBoolean,
  adjustment_brightness: validateNonNegativeNumber(),
  adjustment_contrast: validateNonNegativeNumber(),
  adjustment_saturation: validateNonNegativeNumber(),

  ssr_enabled: validateBoolean,

  // Glow — every knob the compositor pass reads, so a typo in one is reported
  // rather than silently falling back to a Godot default.
  glow_enabled: v.boolean('glow_enabled'),
  glow_normalized: v.boolean('glow_normalized'),
  glow_intensity: v.nonNegativeFloat('glow_intensity'),
  glow_strength: v.nonNegativeFloat('glow_strength'),
  glow_mix: v.nonNegativeFloat('glow_mix'),
  glow_bloom: v.nonNegativeFloat('glow_bloom'),
  glow_blend_mode: v.enumInt('glow_blend_mode', 0, 4, {
    0: 'ADDITIVE',
    1: 'SCREEN',
    2: 'SOFTLIGHT',
    3: 'REPLACE',
    4: 'MIX',
  }),
  glow_hdr_threshold: v.nonNegativeFloat('glow_hdr_threshold'),
  glow_hdr_scale: v.nonNegativeFloat('glow_hdr_scale'),
  glow_hdr_luminance_cap: v.nonNegativeFloat('glow_hdr_luminance_cap'),
  glow_map_strength: v.nonNegativeFloat('glow_map_strength'),
  // `glow_levels/1`..`glow_levels/7` are seven independent float properties; the
  // registry matches a `prefix/*` pattern, so they need no per-level entries.
  'glow_levels/*': v.nonNegativeFloat('glow_levels'),
});

// Export validators for reuse
export { validateBoolean, validateColor };
