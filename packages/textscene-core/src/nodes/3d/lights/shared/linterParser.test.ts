/**
 * Tests for the Light3D shared validator registration (shared/linterParser.ts).
 *
 * Verifies that `light_*` and `shadow_*` validators are registered under the
 * abstract 'Light3D' key and therefore reach every concrete light subclass via
 * the base-walk (DirectionalLight3D / OmniLight3D / SpotLight3D / AreaLight3D
 * → Light3D → Node3D).
 */

import { describe, it } from 'vitest';
import {
  node,
  scene,
  expectClean,
  expectNoErrors,
  runPropertyValidation,
} from '../../../../linter/testing/testkit';
import './linterParser';
import '../../../base/node3d/linterParser.js';

describe('Light3D shared validators', () => {
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
    ]);
  });

  describe('happy-path: all shared light_* and shadow_* properties are clean', () => {
    it('accepts all shared base properties on a concrete light type', () => {
      expectClean(
        scene(
          node('DirectionalLight3D', {
            light_energy: '1.0',
            light_color: 'Color(1, 1, 1, 1)',
            light_indirect_energy: '1.0',
            light_volumetric_fog_energy: '0.5',
            light_negative: false,
            light_specular: '0.5',
            light_bake_mode: 1,
            light_cull_mask: 1048575,
            shadow_enabled: true,
            shadow_bias: '0.1',
            shadow_normal_bias: '2.0',
            shadow_blur: '1.0',
            shadow_transmittance_bias: '0.0',
            shadow_opacity: '1.0',
            shadow_reverse_cull_face: false,
          })
        )
      );
    });
  });
});
