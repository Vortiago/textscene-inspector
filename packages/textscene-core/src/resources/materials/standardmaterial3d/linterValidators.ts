/**
 * Strict parser validation for StandardMaterial3D SubResource properties.
 * Validates format and basic constraints during parse time.
 *
 * Note: Full semantic validation (e.g., checking normal_enabled=true requires normal_texture)
 * would require extending the linter to validate SubResources, not just nodes.
 * For now, we validate basic format constraints.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import { COLOR_RE, FLOAT_PATTERN_SOURCE } from '../../../parser/vectors.js';

/**
 * Validate boolean properties (normal_enabled, etc.)
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
 * A texture slot accepts an `ExtResource` (imported image / `.tres`) OR a
 * `SubResource` (an inline/procedural Texture2D — GradientTexture2D,
 * NoiseTexture2D, CanvasTexture). Accept both; only a malformed reference errors.
 */
const validateTextureReference: PropertyValidator = (key, value, line) => {
  const referencePattern = /^(?:Sub|Ext)Resource\("([^"]+)"\)$/;
  if (!referencePattern.test(value)) {
    return {
      severity: 'error',
      message: `Property "${key}" must be a resource reference like ExtResource("1_abc") or SubResource("Tex_1"), got: ${value}`,
      line,
      column: 0,
      code: 'INVALID_TEXTURE_REFERENCE',
    };
  }
  return null;
};

/**
 * Validate Color format: Color(r, g, b, a)
 */
const validateAlbedoColor: PropertyValidator = (key, value, line) => {
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
 * Validate Vector3 format for uv1_scale
 * Note: Zero component validation should be added as a separate lint rule if needed,
 * as property validators can only return errors, not warnings.
 */
const validateUv1Scale: PropertyValidator = (key, value, line) => {
  const f = FLOAT_PATTERN_SOURCE;
  const vector3Pattern = new RegExp(
    String.raw`^Vector3\s*\(\s*(${f})\s*,\s*(${f})\s*,\s*(${f})\s*\)$`
  );
  const match = value.match(vector3Pattern);

  if (!match) {
    return {
      severity: 'error',
      message: `Property "${key}" must be a Vector3 like Vector3(1, 1, 1), got: ${value}`,
      line,
      column: 0,
      code: 'INVALID_VECTOR3',
    };
  }

  return null;
};

// Register validators for StandardMaterial3D properties
validatorRegistry.registerAll('StandardMaterial3D', {
  normal_enabled: validateBoolean,
  emission_enabled: validateBoolean,
  clearcoat_enabled: validateBoolean,
  rim_enabled: validateBoolean,
  heightmap_enabled: validateBoolean,
  anisotropy_enabled: validateBoolean,
  refraction_enabled: validateBoolean,
  normal_texture: validateTextureReference,
  albedo_texture: validateTextureReference,
  metallic_texture: validateTextureReference,
  roughness_texture: validateTextureReference,
  ao_texture: validateTextureReference,
  emission_texture: validateTextureReference,
  heightmap_texture: validateTextureReference,
  uv1_scale: validateUv1Scale,
  albedo_color: validateAlbedoColor,
});
