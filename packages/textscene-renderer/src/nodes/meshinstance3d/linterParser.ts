/**
 * MeshInstance3D strict validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../linter/ValidatorRegistry.js';

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
        column: key.length + 3, // Account for "key = " prefix
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
