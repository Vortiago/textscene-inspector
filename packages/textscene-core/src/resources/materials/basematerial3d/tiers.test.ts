/**
 * The tier each BaseMaterial3D bound reports, pinned per property.
 *
 * `endSeverity` derives the severity FROM the declared grounding, so a bound
 * tagged `enforced` when the setter merely assigns stays self-consistent and no
 * sweep can catch it. Naming the expected severity here puts the claim in a
 * second file. One case per DISTINCT claim, not per property: the repeated
 * `0,1,0.01` hinted floats are one claim, and the four `ERR_FAIL_INDEX`
 * channels are another.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { runResourcePropertyValidation } from '../../../linter/testing/testkit.js';
import '../../../linter/index';

runResourcePropertyValidation('StandardMaterial3D', [
  {
    prop: 'metallic',
    valid: ['0', '0.5', '1'],
    // "0,1,0.01" with a bare-assigning setter: stored as written, off-slider.
    invalid: [
      { value: '1.5', contains: ['metallic'], severity: 'warning' },
      { value: '-0.1', contains: ['metallic'], severity: 'warning' },
    ],
  },
  {
    prop: 'metallic_texture_channel',
    valid: ['0', '4'],
    // ERR_FAIL_INDEX(p_channel, 5) refuses the write outright.
    invalid: [{ value: '5', contains: ['metallic_texture_channel'], severity: 'error' }],
  },
  {
    prop: 'uv1_triplanar_sharpness',
    valid: ['0', '1', '150'],
    // EXP_EASING states no range; the CLAMP in the setter is the whole bound.
    invalid: [{ value: '151', contains: ['uv1_triplanar_sharpness'], severity: 'error' }],
  },
  {
    prop: 'proximity_fade_distance',
    valid: ['0.01', '4096'],
    // The one split bound: MAX() on the floor, hint alone on the ceiling.
    invalid: [
      { value: '0', contains: ['proximity_fade_distance'], severity: 'error' },
      { value: '5000', contains: ['proximity_fade_distance'], severity: 'warning' },
    ],
  },
  {
    prop: 'anisotropy',
    // The negative half of the hint is a real value, not a sign error.
    valid: ['-1', '0', '1'],
    invalid: [{ value: '-1.5', contains: ['anisotropy'], severity: 'warning' }],
  },
  {
    prop: 'stencil_flags',
    valid: ['0', '1', '2', '6'],
    invalid: [
      // READ together with WRITE: the setter keeps READ alone.
      { value: '3', contains: ['READ and WRITE'], severity: 'error' },
      // A bit the flag list does not offer, kept as written.
      { value: '8', contains: ['stencil_flags'], severity: 'warning' },
    ],
  },
  {
    prop: 'fov_override',
    // "1,179,0.1,degrees" — the `.tscn` stores the degrees the hint names.
    valid: ['1', '75', '179'],
    invalid: [{ value: '180', contains: ['fov_override'], severity: 'warning' }],
  },
]);

describe('BaseMaterial3D validator placement', () => {
  it('registers nothing on the leaves a scene names', () => {
    for (const leaf of ['StandardMaterial3D', 'ORMMaterial3D']) {
      expect(validatorRegistry.getOwnKeys(leaf)).toEqual([]);
    }
  });

  it('covers every group of the engine declaration', () => {
    // One key per module, so a dropped spread in the registration is visible
    // here rather than as a quietly missing validator.
    for (const key of [
      'blend_mode',
      'albedo_color',
      'clearcoat',
      'uv2_offset',
      'billboard_mode',
      'stencil_color',
    ]) {
      expect(validatorRegistry.findValidator('StandardMaterial3D', key)).not.toBeNull();
    }
  });
});
