/**
 * MeshInstance3D strict validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

// Resource reference format: SubResource("id") or ExtResource("id")
const RESOURCE_REFERENCE_REGEX = /^(SubResource|ExtResource)\("[\w-]+"\)$/;

// Transform3D format: Transform3D(12 comma-separated numbers)
const TRANSFORM3D_REGEX = /^Transform3D\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

validatorRegistry.registerAll('MeshInstance3D', {
  /**
   * Validate cast_shadow property
   * Must be a number from 0-3:
   * 0 = OFF, 1 = ON, 2 = DOUBLE_SIDED, 3 = SHADOWS_ONLY
   */
  'cast_shadow': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'cast_shadow' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_CAST_SHADOW_FORMAT',
      };
    }
    if (num < 0 || num > 3) {
      return {
        severity: 'error',
        message: `Property 'cast_shadow' must be 0-3 (got ${num}). Valid values: 0=OFF, 1=ON, 2=DOUBLE_SIDED, 3=SHADOWS_ONLY`,
        line,
        column: key.length + 3,
        code: 'INVALID_CAST_SHADOW_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate gi_mode property
   * Must be a number from 0-2:
   * 0 = DISABLED, 1 = STATIC, 2 = DYNAMIC
   */
  'gi_mode': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'gi_mode' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_GI_MODE_FORMAT',
      };
    }
    if (num < 0 || num > 2) {
      return {
        severity: 'error',
        message: `Property 'gi_mode' must be 0-2 (got ${num}). Valid values: 0=DISABLED, 1=STATIC, 2=DYNAMIC`,
        line,
        column: key.length + 3,
        code: 'INVALID_GI_MODE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate gi_lightmap_scale property
   * Must be a number from 0-3:
   * 0 = 1x, 1 = 2x, 2 = 4x, 3 = 8x
   */
  'gi_lightmap_scale': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'gi_lightmap_scale' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_GI_LIGHTMAP_SCALE_FORMAT',
      };
    }
    if (num < 0 || num > 3) {
      return {
        severity: 'error',
        message: `Property 'gi_lightmap_scale' must be 0-3 (got ${num}). Valid values: 0=1x, 1=2x, 2=4x, 3=8x`,
        line,
        column: key.length + 3,
        code: 'INVALID_GI_LIGHTMAP_SCALE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate visibility_range_begin property
   * Must be a non-negative float
   */
  'visibility_range_begin': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'visibility_range_begin' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_VISIBILITY_RANGE_BEGIN_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'visibility_range_begin' must be non-negative (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_VISIBILITY_RANGE_BEGIN_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate visibility_range_begin_margin property
   * Must be a non-negative float
   */
  'visibility_range_begin_margin': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'visibility_range_begin_margin' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_VISIBILITY_RANGE_BEGIN_MARGIN_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'visibility_range_begin_margin' must be non-negative (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_VISIBILITY_RANGE_BEGIN_MARGIN_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate visibility_range_end property
   * Must be a non-negative float
   */
  'visibility_range_end': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'visibility_range_end' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_VISIBILITY_RANGE_END_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'visibility_range_end' must be non-negative (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_VISIBILITY_RANGE_END_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate visibility_range_end_margin property
   * Must be a non-negative float
   */
  'visibility_range_end_margin': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'visibility_range_end_margin' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_VISIBILITY_RANGE_END_MARGIN_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'visibility_range_end_margin' must be non-negative (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_VISIBILITY_RANGE_END_MARGIN_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate visibility_range_fade_mode property
   * Must be a number from 0-2:
   * 0 = DISABLED, 1 = SELF, 2 = DEPENDENCIES
   */
  'visibility_range_fade_mode': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'visibility_range_fade_mode' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_VISIBILITY_RANGE_FADE_MODE_FORMAT',
      };
    }
    if (num < 0 || num > 2) {
      return {
        severity: 'error',
        message: `Property 'visibility_range_fade_mode' must be 0-2 (got ${num}). Valid values: 0=DISABLED, 1=SELF, 2=DEPENDENCIES`,
        line,
        column: key.length + 3,
        code: 'INVALID_VISIBILITY_RANGE_FADE_MODE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate layers property
   * Must be a valid bitmask (1-1048575 for bits 1-20)
   */
  'layers': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'layers' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_LAYERS_FORMAT',
      };
    }
    if (num < 1 || num > 1048575) {
      return {
        severity: 'error',
        message: `Property 'layers' must be between 1 and 1048575 (got ${num}). Valid range: bits 1-20`,
        line,
        column: key.length + 3,
        code: 'INVALID_LAYERS_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate mesh resource reference
   * Must be SubResource("id") or ExtResource("id")
   */
  'mesh': (key, value, line) => {
    if (!RESOURCE_REFERENCE_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'mesh' must be a resource reference like SubResource("id") or ExtResource("id"), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_MESH_REFERENCE',
      };
    }
    return null;
  },

  /**
   * Validate material_override resource reference
   * Must be SubResource("id") or ExtResource("id")
   */
  'material_override': (key, value, line) => {
    if (!RESOURCE_REFERENCE_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'material_override' must be a resource reference like SubResource("id") or ExtResource("id"), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_MATERIAL_OVERRIDE_REFERENCE',
      };
    }
    return null;
  },

  /**
   * Validate material_overlay resource reference
   * Must be SubResource("id") or ExtResource("id")
   */
  'material_overlay': (key, value, line) => {
    if (!RESOURCE_REFERENCE_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'material_overlay' must be a resource reference like SubResource("id") or ExtResource("id"), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_MATERIAL_OVERLAY_REFERENCE',
      };
    }
    return null;
  },

  /**
   * Validate skeleton node path
   * Must be a valid NodePath (starts with NodePath("..."))
   */
  'skeleton': (key, value, line) => {
    if (!value.startsWith('NodePath("') || !value.endsWith('")')) {
      return {
        severity: 'error',
        message: `Property 'skeleton' must be a NodePath like NodePath("path/to/skeleton"), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SKELETON_PATH',
      };
    }
    return null;
  },

  /**
   * Validate skin resource reference
   * Must be SubResource("id") or ExtResource("id")
   */
  'skin': (key, value, line) => {
    if (!RESOURCE_REFERENCE_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'skin' must be a resource reference like SubResource("id") or ExtResource("id"), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SKIN_REFERENCE',
      };
    }
    return null;
  },

  /**
   * Validate surface material override (indexed property)
   * Pattern: surface_material_override/0, surface_material_override/1, etc.
   * Value must be a resource reference
   */
  'surface_material_override/*': (key, value, line) => {
    // Extract and validate index
    const match = key.match(/^surface_material_override\/(\d+)$/);
    if (!match || !match[1]) {
      return {
        severity: 'error',
        message: `Invalid surface material override key format: "${key}". Expected: surface_material_override/<number>`,
        line,
        column: 1,
        code: 'INVALID_SURFACE_MATERIAL_KEY',
      };
    }

    const index = parseInt(match[1], 10);
    if (index < 0) {
      return {
        severity: 'error',
        message: `Surface material override index must be non-negative, got: ${index}`,
        line,
        column: 1,
        code: 'INVALID_SURFACE_MATERIAL_INDEX',
      };
    }

    // Validate resource reference format
    if (!RESOURCE_REFERENCE_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property '${key}' must be a resource reference like SubResource("id") or ExtResource("id"), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SURFACE_MATERIAL_REFERENCE',
      };
    }

    return null;
  },

  /**
   * Validate transform property
   * Must be Transform3D(12 comma-separated numbers)
   */
  'transform': (key, value, line) => {
    if (!TRANSFORM3D_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'transform' must be Transform3D with 12 numbers like Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_TRANSFORM_FORMAT',
      };
    }
    return null;
  },
});
