/**
 * Tests for the Light3D shared validator registration (shared/linterParser.ts).
 *
 * Verifies that `light_*` and `shadow_*` validators are registered under the
 * abstract 'Light3D' key and therefore reach every concrete light subclass via
 * the base-walk (DirectionalLight3D / OmniLight3D / SpotLight3D / AreaLight3D
 * → Light3D → Node3D).
 */

import { describe, expect, it } from 'vitest';
import {
  node,
  scene,
  expectClean,
  expectNoErrors,
  runPropertyValidation,
} from '../../../../linter/testing/testkit';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';
import '../../../base/node3d/linterParser.js';

/** The error a Light3D validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('Light3D', property);
  expect(validator, `no validator registered for Light3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Every `ADD_PROPERTY`/`ADD_PROPERTYI` key in `Light3D::_bind_methods`
 * (light_3d.cpp:385-418), in source order. Pins the coverage gap shut: a key
 * dropped from `linterParser.ts` fails this list rather than silently
 * reopening the gap.
 */
const KEYS: string[] = [
  'light_intensity_lumens',
  'light_intensity_lux',
  'light_temperature',
  'light_color',
  'light_energy',
  'light_indirect_energy',
  'light_volumetric_fog_energy',
  'light_projector',
  'light_size',
  'light_angular_distance',
  'light_negative',
  'light_specular',
  'light_bake_mode',
  'light_cull_mask',
  'shadow_enabled',
  'shadow_bias',
  'shadow_normal_bias',
  'shadow_reverse_cull_face',
  'shadow_transmittance_bias',
  'shadow_opacity',
  'shadow_blur',
  'shadow_caster_mask',
  'distance_fade_enabled',
  'distance_fade_begin',
  'distance_fade_shadow',
  'distance_fade_length',
  'editor_only',
];

describe('Light3D shared validators', () => {
  it('registers exactly what Light3D::_bind_methods binds (light_3d.cpp:385-418)', () => {
    expect(validatorRegistry.getOwnKeys('Light3D').sort()).toEqual([...KEYS].sort());
  });

  describe('light_* and shadow_* validators are inherited by concrete light types', () => {
    it('accepts a valid light_energy on DirectionalLight3D (no own validators needed)', () => {
      expectNoErrors(scene(node('DirectionalLight3D', { light_energy: '1.5' })));
    });

    it('accepts zero light_energy', () => {
      expectNoErrors(scene(node('DirectionalLight3D', { light_energy: 0 })));
    });

    runPropertyValidation({ nodeType: 'DirectionalLight3D' }, [
      {
        // light_3d.cpp:389 hints "0,16,0.001,or_greater", and Light3D::set_param:36
        // guards the param INDEX rather than the value, so a negative energy is
        // loaded as written: it warns in the slice rule, it does not error here.
        prop: 'light_energy',
        valid: [1.0, '-0.5'],
        acceptMode: 'no-error',
        invalid: [{ value: 'bad', contains: ['must be a number'] }],
      },
      {
        prop: 'light_color',
        valid: ['Color(1, 1, 1, 1)'],
        invalid: [
          { value: 'RGB(1, 1, 1)', contains: ['Color'] },
          { value: 'Color(1, 1, 1)' },
        ],
      },
      {
        prop: 'shadow_enabled',
        valid: [true, false],
        invalid: [{ value: 'yes', contains: ['boolean'] }],
      },
      {
        prop: 'shadow_opacity',
        valid: [0, 0.5, 1],
        invalid: [
          { value: -0.1, contains: ['between 0 and 1'] },
          { value: 1.5, contains: ['between 0 and 1'] },
        ],
      },
      {
        // light_3d.cpp:406 hints "-16,16,0.001" (both ends closed), warning-only
        // since set_param:36 only guards the param index.
        prop: 'shadow_transmittance_bias',
        valid: [-16, 0, 16],
        invalid: [
          { value: -17, contains: ['between -16 and 16'] },
          { value: 17, contains: ['between -16 and 16'] },
        ],
      },
      {
          prop: 'light_cull_mask',
          valid: [1, 1048575, 0, 2000000, 2147483648, 4294967295],
          invalid: [

          ],
        },
      {
        // light_3d.cpp:385 hints "0,100000.0,0.01,or_greater,suffix:lm", and
        // Light3D::set_param:36 guards the param INDEX rather than the value,
        // so a negative reading loads and warns rather than errors.
        prop: 'light_intensity_lumens',
        valid: [0, 100000, '-5'],
        acceptMode: 'no-error',
        invalid: [{ value: 'bad', contains: ['must be a number'] }],
      },
      {
        // light_3d.cpp:386 hints "0,150000.0,0.01,or_greater,suffix:lx".
        prop: 'light_intensity_lux',
        valid: [0, 150000, '-5'],
        acceptMode: 'no-error',
        invalid: [{ value: 'bad', contains: ['must be a number'] }],
      },
      {
        // light_3d.cpp:387 hints "1000,15000.0,1.0,suffix:k" — both ends closed
        // (no or_greater/or_less). set_temperature (light_3d.cpp:257) is a bare
        // assignment, so out-of-hint is a warning, not an error.
        prop: 'light_temperature',
        valid: [1000, 15000, 6500],
        acceptMode: 'no-error',
        invalid: [{ value: 'bad', contains: ['must be a number'] }],
      },
      {
        // light_3d.cpp:393, PROPERTY_HINT_RESOURCE_TYPE "Texture2D,-Animated…".
        // Format only, like every other single Texture2D reference property
        // (Decal.texture_albedo, Sprite3D.texture).
        prop: 'light_projector',
        valid: ['ExtResource("1_a")', 'SubResource("Texture_1")'],
        invalid: [{ value: '"not_a_reference"', contains: ['light_projector'] }],
      },
      {
        // light_3d.cpp:394 hints "0,1,0.001,or_greater,suffix:m". set_param:36
        // guards the index, not the value, so a size past the hint is a warning.
        prop: 'light_size',
        valid: [0, 1, 4],
        acceptMode: 'no-error',
        invalid: [{ value: 'bad', contains: ['must be a number'] }],
      },
      {
        // light_3d.cpp:395 hints "0,90,0.01,degrees" — both ends closed. The
        // bare "degrees" token is a display-only suffix, not "radians_as_degrees",
        // so the stored value is already degrees and the hint bound applies
        // unconverted.
        prop: 'light_angular_distance',
        valid: [0, 90, 45],
        acceptMode: 'no-error',
        invalid: [{ value: 'bad', contains: ['must be a number'] }],
      },
      {
        // light_3d.cpp:409, PROPERTY_HINT_LAYERS_3D_RENDER. set_shadow_caster_mask
        // (light_3d.cpp:148) is a bare assignment, so the 32-checkbox widget
        // width is a warning like light_cull_mask, never an error.
        prop: 'shadow_caster_mask',
        valid: [1, 1048575, 0, 2000000, 2147483648, 4294967295],
        invalid: [{ value: 'bad', contains: ['must be a number'] }],
      },
      {
        // light_3d.cpp:412, PROPERTY_HINT_GROUP_ENABLE — a checkable-group
        // marker for the inspector, not a value constraint (object.h:93).
        prop: 'distance_fade_enabled',
        valid: [true, false],
        invalid: [{ value: 'yes', contains: ['boolean'] }],
      },
      {
        // light_3d.cpp:413, PROPERTY_HINT_RANGE "0.0,4096.0,0.01,or_greater,suffix:m".
        // set_distance_fade_begin (light_3d.cpp:85) is a bare assignment.
        prop: 'distance_fade_begin',
        valid: [0, 4096, '-1'],
        acceptMode: 'no-error',
        invalid: [{ value: 'bad', contains: ['must be a number'] }],
      },
      {
        // light_3d.cpp:414, same hint shape as distance_fade_begin.
        // set_distance_fade_shadow (light_3d.cpp:94) is a bare assignment.
        prop: 'distance_fade_shadow',
        valid: [0, 4096, '-1'],
        acceptMode: 'no-error',
        invalid: [{ value: 'bad', contains: ['must be a number'] }],
      },
      {
        // light_3d.cpp:415, same hint shape as distance_fade_begin.
        // set_distance_fade_length (light_3d.cpp:103) is a bare assignment.
        prop: 'distance_fade_length',
        valid: [0, 4096, '-1'],
        acceptMode: 'no-error',
        invalid: [{ value: 'bad', contains: ['must be a number'] }],
      },
      {
        // light_3d.cpp:418, PROPERTY_HINT_NONE (no hint at all). set_editor_only
        // (light_3d.cpp:315) is a bare assignment, so this is a format-only bool.
        prop: 'editor_only',
        valid: [true, false],
        invalid: [{ value: 'yes', contains: ['boolean'] }],
      },
    ]);
  });

  describe('shadow_bias / shadow_normal_bias / shadow_blur: hint bound tightened to "0,10,0.001"', () => {
    // All three share PROPERTY_HINT_RANGE "0,10,0.001" (light_3d.cpp:403,
    // :404, :408) with neither or_greater nor or_less, so both ends are
    // closed. set_param:36 guards the param INDEX only, so out-of-hint warns.
    it.each(['shadow_bias', 'shadow_normal_bias', 'shadow_blur'])(
      'accepts the inclusive bounds 0 and 10 on %s',
      (property) => {
        expect(check(property, '0')).toBeNull();
        expect(check(property, '10')).toBeNull();
      }
    );

    it.each(['shadow_bias', 'shadow_normal_bias', 'shadow_blur'])(
      'warns rather than errors above the hint max on %s (25)',
      (property) => {
        const error = check(property, '25');
        expect(error?.severity).toBe('warning');
        expect(error?.message).toContain(property);
      }
    );

    it.each(['shadow_bias', 'shadow_normal_bias', 'shadow_blur'])(
      'warns rather than errors below the hint min on %s (-1)',
      (property) => {
        const error = check(property, '-1');
        expect(error?.severity).toBe('warning');
        expect(error?.message).toContain(property);
      }
    );
  });

  describe('light_temperature and light_angular_distance: closed hint bounds fire on both ends', () => {
    it('warns above the light_temperature max (light_3d.cpp:387, "1000,15000.0,1.0")', () => {
      const error = check('light_temperature', '15001');
      expect(error?.severity).toBe('warning');
      expect(error?.message).toContain('light_temperature');
    });

    it('warns below the light_temperature min', () => {
      const error = check('light_temperature', '999');
      expect(error?.severity).toBe('warning');
      expect(error?.message).toContain('light_temperature');
    });

    it('warns above the light_angular_distance max (light_3d.cpp:395, "0,90,0.01,degrees")', () => {
      const error = check('light_angular_distance', '91');
      expect(error?.severity).toBe('warning');
      expect(error?.message).toContain('light_angular_distance');
    });

    it('warns below the light_angular_distance min', () => {
      const error = check('light_angular_distance', '-1');
      expect(error?.severity).toBe('warning');
      expect(error?.message).toContain('light_angular_distance');
    });
  });

  describe('happy-path: all shared light_* and shadow_* properties are clean', () => {
    it('accepts all shared base properties on a concrete light type', () => {
      expectClean(
        scene(
          '[ext_resource type="Texture2D" path="res://projector.png" id="1_a"]',
          node('DirectionalLight3D', {
            light_energy: '1.0',
            light_color: 'Color(1, 1, 1, 1)',
            light_indirect_energy: '1.0',
            light_volumetric_fog_energy: '0.5',
            light_negative: false,
            light_specular: '0.5',
            light_bake_mode: 1,
            light_cull_mask: 1048575,
            light_intensity_lumens: '1000.0',
            light_intensity_lux: '1000.0',
            light_temperature: '6500.0',
            light_projector: 'ExtResource("1_a")',
            light_size: '0.0',
            light_angular_distance: '0.0',
            shadow_enabled: true,
            shadow_bias: '0.1',
            shadow_normal_bias: '2.0',
            shadow_blur: '1.0',
            shadow_transmittance_bias: '0.0',
            shadow_opacity: '1.0',
            shadow_reverse_cull_face: false,
            shadow_caster_mask: 1048575,
            distance_fade_enabled: false,
            distance_fade_begin: '40.0',
            distance_fade_shadow: '50.0',
            distance_fade_length: '10.0',
            editor_only: false,
          })
        )
      );
    });
  });
});
