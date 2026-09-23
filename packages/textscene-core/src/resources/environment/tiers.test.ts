/**
 * The tier each Environment bound reports, and the properties that must carry no
 * bound. Most setters bare-assign, so this pins the four enforced bounds and the
 * open-ended hints, where an invented floor would false-error on a Godot scene.
 */

import { runResourcePropertyValidation } from '../../linter/testing/testkit.js';
import '../../linter/index';

runResourcePropertyValidation('Environment', [
  {
    prop: 'ambient_light_sky_contribution',
    valid: ['0', '0.5', '1'],
    // CLAMP(p_ratio, 0.0, 1.0): the value stored is not the value written.
    invalid: [{ value: '1.5', contains: ['ambient_light_sky_contribution'], severity: 'error' }],
  },
  {
    prop: 'sdfgi_cascades',
    valid: ['1', '4', '8'],
    invalid: [
      { value: '0', contains: ['sdfgi_cascades'], severity: 'error' },
      { value: '9', contains: ['sdfgi_cascades'], severity: 'error' },
    ],
  },
  {
    prop: 'ssr_fade_in',
    valid: ['0', '1.5'],
    // MAX(p_fade_in, 0.0), on a property whose hint states no range at all.
    invalid: [{ value: '-1', contains: ['ssr_fade_in'], severity: 'error' }],
  },
  {
    prop: 'volumetric_fog_detail_spread',
    valid: ['0.5', '2', '6'],
    invalid: [{ value: '7', contains: ['volumetric_fog_detail_spread'], severity: 'error' }],
  },
  {
    prop: 'ssao_intensity',
    // `or_greater` opens the ceiling, so a big intensity is not a diagnostic.
    valid: ['0', '2', '64'],
    invalid: [{ value: '-1', contains: ['ssao_intensity'], severity: 'warning' }],
  },
  {
    prop: 'reflected_light_source',
    valid: ['0', '1', '2'],
    invalid: [{ value: '3', contains: ['reflected_light_source'], severity: 'warning' }],
  },
  // Both ends open: fog behind the camera and below the world are things scenes
  // set, and a floor invented here would reject them.
  { prop: 'fog_depth_begin', valid: ['-100', '0', '4000', '9000'] },
  { prop: 'fog_height_density', valid: ['-32', '0', '32'] },
  { prop: 'sky_rotation', valid: ['Vector3(0, -3.2, 0)'] },
  // PROPERTY_HINT_EXP_EASING with a bare-assigning setter states no bound.
  { prop: 'ssao_power', valid: ['-1', '0', '12'] },
]);
