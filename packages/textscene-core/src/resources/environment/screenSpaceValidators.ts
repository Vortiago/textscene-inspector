/**
 * Environment's SSR, SSAO, SSIL and SDFGI groups (`environment.cpp:1306-1403`).
 *
 * Three enforced bounds, each named at its guard; everything else bare-assigns
 * and is the hinted tier. `PROPERTY_HINT_EXP_EASING` states no range, so a
 * property carrying it gets a bound only where its setter has one.
 */

import type { PropertyValidator } from '../../linter/ValidatorRegistry.js';
import { v } from '../../linter/validators/index.js';

export const screenSpaceKeys: Record<string, PropertyValidator> = {
  ssr_enabled: v.boolean('ssr_enabled'),
  // environment.cpp:1307 ("32,512,1"), set_ssr_max_steps (:267) bare-assigns.
  ssr_max_steps: v.int('ssr_max_steps', { min: 32, max: 512, hinted: 'environment.cpp:1307' }),
  // MAX(p, 0.0) at :277 and :286: a negative fade is altered, not only off-slider.
  ssr_fade_in: v.float('ssr_fade_in', { min: 0, enforced: 'environment.cpp:277' }),
  ssr_fade_out: v.float('ssr_fade_out', { min: 0, enforced: 'environment.cpp:286' }),
  // environment.cpp:1310 ("0.01,128,0.1"), setter (:294) bare-assigns.
  ssr_depth_tolerance: v.float('ssr_depth_tolerance', {
    min: 0.01,
    max: 128,
    hinted: 'environment.cpp:1310',
  }),

  ssao_enabled: v.boolean('ssao_enabled'),
  // environment.cpp:1334-1335, both `or_greater`: floor only.
  ssao_radius: v.float('ssao_radius', { min: 0.01, hinted: 'environment.cpp:1334' }),
  ssao_intensity: v.nonNegativeFloat('ssao_intensity', { hinted: 'environment.cpp:1335' }),
  // environment.cpp:1336 is EXP_EASING, so no range; set_ssao_power (:342) bare-assigns.
  ssao_power: v.float('ssao_power'),
  // environment.cpp:1337-1341, all closed at both ends.
  ssao_detail: v.float('ssao_detail', { min: 0, max: 5, hinted: 'environment.cpp:1337' }),
  ssao_horizon: v.float('ssao_horizon', { min: 0, max: 1, hinted: 'environment.cpp:1338' }),
  ssao_sharpness: v.float('ssao_sharpness', { min: 0, max: 1, hinted: 'environment.cpp:1339' }),
  ssao_light_affect: v.float('ssao_light_affect', {
    min: 0,
    max: 1,
    hinted: 'environment.cpp:1340',
  }),
  ssao_ao_channel_affect: v.float('ssao_ao_channel_affect', {
    min: 0,
    max: 1,
    hinted: 'environment.cpp:1341',
  }),

  ssil_enabled: v.boolean('ssil_enabled'),
  // environment.cpp:1357-1358, both `or_greater`: floor only.
  ssil_radius: v.float('ssil_radius', { min: 0.01, hinted: 'environment.cpp:1357' }),
  ssil_intensity: v.nonNegativeFloat('ssil_intensity', { hinted: 'environment.cpp:1358' }),
  // environment.cpp:1359-1360
  ssil_sharpness: v.float('ssil_sharpness', { min: 0, max: 1, hinted: 'environment.cpp:1359' }),
  ssil_normal_rejection: v.float('ssil_normal_rejection', {
    min: 0,
    max: 1,
    hinted: 'environment.cpp:1360',
  }),

  sdfgi_enabled: v.boolean('sdfgi_enabled'),
  sdfgi_use_occlusion: v.boolean('sdfgi_use_occlusion'),
  sdfgi_read_sky_light: v.boolean('sdfgi_read_sky_light'),
  // environment.cpp:1393 ("0,1.99,0.01"), setter (:542) bare-assigns.
  sdfgi_bounce_feedback: v.float('sdfgi_bounce_feedback', {
    min: 0,
    max: 1.99,
    hinted: 'environment.cpp:1393',
  }),
  // ERR_FAIL_COND_MSG(p_cascades < 1 || p_cascades > 8) at :479 refuses the write.
  sdfgi_cascades: v.int('sdfgi_cascades', { min: 1, max: 8, enforced: 'environment.cpp:479' }),
  // environment.cpp:1395 ("0.01,64,0.01"), setter (:488) bare-assigns.
  sdfgi_min_cell_size: v.float('sdfgi_min_cell_size', {
    min: 0.01,
    max: 64,
    hinted: 'environment.cpp:1395',
  }),
  // environment.cpp:1400, set_sdfgi_y_scale (:524) bare-assigns.
  sdfgi_y_scale: v.enumInt(
    'sdfgi_y_scale',
    0,
    2,
    { 0: 'Y_SCALE_50_PERCENT', 1: 'Y_SCALE_75_PERCENT', 2: 'Y_SCALE_100_PERCENT' },
    { hinted: 'environment.cpp:1400' }
  ),
  // environment.cpp:1401-1403 carry no hint at all, so there is nothing to bound.
  sdfgi_energy: v.float('sdfgi_energy'),
  sdfgi_normal_bias: v.float('sdfgi_normal_bias'),
  sdfgi_probe_bias: v.float('sdfgi_probe_bias'),
};
