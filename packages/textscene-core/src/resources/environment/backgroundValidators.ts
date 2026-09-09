/**
 * Environment's Background, Sky, Ambient Light and Reflected Light groups
 * (`environment.cpp:1236-1270`).
 *
 * One enforced bound in here, and the rest are the hinted tier:
 * `set_ambient_light_sky_contribution` stores `CLAMP(p_ratio, 0.0, 1.0)`
 * (environment.cpp:173), so a ratio outside it is altered rather than merely
 * outside the inspector's slider.
 */

import type { PropertyValidator } from '../../linter/ValidatorRegistry.js';
import { v } from '../../linter/validators/index.js';

export const backgroundKeys: Record<string, PropertyValidator> = {
  // environment.cpp:1237, set_background (:43-49) is a bare assignment.
  background_mode: v.enumInt(
    'background_mode',
    0,
    5,
    {
      0: 'BG_CLEAR_COLOR',
      1: 'BG_COLOR',
      2: 'BG_SKY',
      3: 'BG_CANVAS',
      4: 'BG_KEEP',
      5: 'BG_CAMERA_FEED',
    },
    { hinted: 'environment.cpp:1237' }
  ),
  background_color: v.color('background_color'),
  // environment.cpp:1239 ("0,16,0.01"), set_bg_energy_multiplier (:96) bare-assigns.
  background_energy_multiplier: v.float('background_energy_multiplier', {
    min: 0,
    max: 16,
    hinted: 'environment.cpp:1239',
  }),
  // environment.cpp:1240 ("0,100000,0.01,suffix:nt"), set_bg_intensity (:105) bare assigns.
  background_intensity: v.float('background_intensity', {
    min: 0,
    max: 100000,
    hinted: 'environment.cpp:1240',
  }),
  // environment.cpp:1242 ("-1000,1000,1"), set_canvas_max_layer (:122) bare assigns.
  background_canvas_max_layer: v.int('background_canvas_max_layer', {
    min: -1000,
    max: 1000,
    hinted: 'environment.cpp:1242',
  }),
  // environment.cpp:1243 ("1,10,1"), set_camera_feed_id (:131) bare assigns.
  background_camera_feed_id: v.int('background_camera_feed_id', {
    min: 1,
    max: 10,
    hinted: 'environment.cpp:1243',
  }),

  sky: v.resourceReference('sky'),
  // environment.cpp:1247 ("0,180,0.1,degrees"): the `.tscn` stores the degrees
  // the hint names, unlike `sky_rotation` below.
  sky_custom_fov: v.float('sky_custom_fov', { min: 0, max: 180, hinted: 'environment.cpp:1247' }),
  // environment.cpp:1248 hints "-360,360,0.1,or_less,or_greater,radians_as_degrees":
  // BOTH ends open, so any rotation is legal and only the Vector3 shape is checkable.
  sky_rotation: v.vector3('sky_rotation'),

  // environment.cpp:1264, set_ambient_source (:151-155) is a bare assignment.
  ambient_light_source: v.enumInt(
    'ambient_light_source',
    0,
    3,
    {
      0: 'BG',
      1: 'DISABLED',
      2: 'COLOR',
      3: 'SKY',
    },
    { hinted: 'environment.cpp:1264' }
  ),
  ambient_light_color: v.color('ambient_light_color'),
  // environment.cpp:1266 ("0,1,0.01"), and the CLAMP at :173 is what makes this
  // an error rather than a warning: the value stored is not the value written.
  ambient_light_sky_contribution: v.float('ambient_light_sky_contribution', {
    min: 0,
    max: 1,
    enforced: 'environment.cpp:173',
  }),
  // environment.cpp:1267 ("0,16,0.01"), set_ambient_light_energy (:161) bare-assigns.
  ambient_light_energy: v.float('ambient_light_energy', {
    min: 0,
    max: 16,
    hinted: 'environment.cpp:1267',
  }),

  // environment.cpp:1270, set_reflection_source (:181) is a bare assignment.
  reflected_light_source: v.enumInt(
    'reflected_light_source',
    0,
    2,
    { 0: 'BG', 1: 'DISABLED', 2: 'SKY' },
    { hinted: 'environment.cpp:1270' }
  ),
};
