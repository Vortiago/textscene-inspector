/**
 * The OpenXRCompositionLayer set must reach its subclasses, which is the whole point of
 * the tier. Assert through `findValidator` on a real leaf, not just on the
 * abstract key: a tier that registers but is never imported registers nothing.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { StrictTscnParser } from '../../../../linter/StrictTscnParser.js';
import './linterParser.js';

/**
 * Every key OpenXRCompositionLayer binds, read from its ADD_PROPERTY calls
 * (openxr_composition_layer.cpp:151-170).
 */
const KEYS: string[] = [
  'layer_viewport',
  'use_android_surface',
  'protected_content',
  'android_surface_size',
  'sort_order',
  'alpha_blend',
  'enable_hole_punch',
  'swapchain_state_min_filter',
  'swapchain_state_mag_filter',
  'swapchain_state_mipmap_mode',
  'swapchain_state_horizontal_wrap',
  'swapchain_state_vertical_wrap',
  'swapchain_state_red_swizzle',
  'swapchain_state_green_swizzle',
  'swapchain_state_blue_swizzle',
  'swapchain_state_alpha_swizzle',
  'swapchain_state_max_anisotropy',
  'swapchain_state_border_color',
];
/** True only when the class binds no ADD_PROPERTY, beside the source line that proves it. */
const DECLARES_NOTHING = false;
const LEAVES = ["OpenXRCompositionLayerCylinder","OpenXRCompositionLayerEquirect","OpenXRCompositionLayerQuad"] as const;

/** The error a validator returns for a value, or null when it accepts it. */
function check(nodeType: string, property: string, value: string) {
  const validator = validatorRegistry.findValidator(nodeType, property);
  expect(validator, `no validator registered for ${nodeType}.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('OpenXRCompositionLayer shared validators', () => {
  it('registers exactly what OpenXRCompositionLayer binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('OpenXRCompositionLayer').sort()).toEqual([...KEYS].sort());
  });

  it.each(LEAVES)('delivers every key to %s through the base-walk', (nodeType) => {
    const missing = KEYS.filter((key) => !validatorRegistry.findValidator(nodeType, key));
    expect(missing).toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    const accepted = KEYS.filter(
      (key) => check('OpenXRCompositionLayerQuad', key, 'definitely-not-a-valid-value') === null
    );
    expect(accepted).toEqual([]);
  });

  describe('layer_viewport', () => {
    it('accepts a NodePath', () => {
      expect(check('OpenXRCompositionLayerQuad', 'layer_viewport', 'NodePath("SubViewport")')).toBeNull();
    });
    it('rejects a bare node reference', () => {
      expect(check('OpenXRCompositionLayerQuad', 'layer_viewport', 'SubViewport')).not.toBeNull();
    });
    // `variant_parser.cpp:699` reads a bare `null`/`nil`, NIL converts to OBJECT
    // (variant.cpp:543-545), and `set_layer_viewport` (openxr_composition_layer.cpp:295-305) clears
    // the slot with no ERR_FAIL; the engine passes `nullptr` itself at :345. One arm per leaf
    // proves the shared registration reaches all three.
    it.each(LEAVES)('accepts an explicitly cleared slot on %s', (nodeType) => {
      expect(check(nodeType, 'layer_viewport', 'null')).toBeNull();
      expect(check(nodeType, 'layer_viewport', 'nil')).toBeNull();
    });
  });

  describe('android_surface_size / sort_order — format only, no bound', () => {
    it('accepts a negative sort_order (hole-punch placement)', () => {
      expect(check('OpenXRCompositionLayerQuad', 'sort_order', '-1')).toBeNull();
    });
    it('accepts any Vector2i for android_surface_size', () => {
      expect(check('OpenXRCompositionLayerQuad', 'android_surface_size', 'Vector2i(2048, 2048)')).toBeNull();
    });
  });

  describe('swapchain_state_* enums', () => {
    it('accepts an in-range swapchain_state_min_filter and reports the range as a warning out of range', () => {
      expect(check('OpenXRCompositionLayerQuad', 'swapchain_state_min_filter', '2')).toBeNull();
      const error = check('OpenXRCompositionLayerQuad', 'swapchain_state_min_filter', '3');
      expect(error?.severity).toBe('warning');
    });
    it('accepts the widest enum (swizzle, 0-5) and warns past it', () => {
      expect(check('OpenXRCompositionLayerQuad', 'swapchain_state_red_swizzle', '5')).toBeNull();
      expect(check('OpenXRCompositionLayerQuad', 'swapchain_state_red_swizzle', '6')?.severity).toBe('warning');
    });
  });

  describe('swapchain_state_max_anisotropy', () => {
    it('accepts the hinted range and warns outside it', () => {
      expect(check('OpenXRCompositionLayerQuad', 'swapchain_state_max_anisotropy', '16')).toBeNull();
      expect(
        check('OpenXRCompositionLayerQuad', 'swapchain_state_max_anisotropy', '17')?.severity
      ).toBe('warning');
    });
  });

  describe('swapchain_state_border_color', () => {
    it('accepts a Color literal', () => {
      expect(check('OpenXRCompositionLayerQuad', 'swapchain_state_border_color', 'Color(0, 0, 0, 1)')).toBeNull();
    });
  });

  describe('the extension-property family (openxr_composition_layer.cpp:705-737)', () => {
    // No validator is registered, since the key set depends on the OpenXR extension wrappers compiled
    // in. This guards the consequence: an arbitrary `<a>/<b>` key produces no diagnostic on any leaf,
    // so a "flag unknown properties" change breaks this test instead of rejecting a legal scene.
    it.each(LEAVES)('resolves no validator for an extension-style key on %s', (nodeType) => {
      expect(validatorRegistry.findValidator(nodeType, 'fb_composition_layer_alpha_blend/enable')).toBeNull();
    });

    it.each(LEAVES)('produces zero diagnostics for an unregistered extension key on %s', (nodeType) => {
      const source = `[gd_scene format=3]

[node name="XROrigin3D" type="XROrigin3D"]

[node name="Layer" type="${nodeType}" parent="."]
fb_composition_layer_alpha_blend/enable = true
`;
      const result = new StrictTscnParser().parse(source);
      expect(result.errors).toEqual([]);
    });
  });

  describe('resolves each inherited key to the ancestor that declares it', () => {
    // OpenXRCompositionLayer is a Node3D; `visible` is Node3D's own key
    // (nodes/base/node3d/linterParser.ts), not re-declared here.
    it.each(LEAVES)('%s inherits Node3D.visible unchanged', (nodeType) => {
      const owned = validatorRegistry.findValidator('Node3D', 'visible');
      expect(owned).not.toBeNull();
      expect(validatorRegistry.findValidator(nodeType, 'visible')).toBe(owned);
      expect(validatorRegistry.getOwnKeys('OpenXRCompositionLayer')).not.toContain('visible');
    });
  });
});
