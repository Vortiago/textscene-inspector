/**
 * Environment's Fog and Volumetric Fog groups (`environment.cpp:1491-1548`).
 *
 * Several fog properties hint `or_less,or_greater` — both ends open, so they
 * carry no bound at all: fog below the horizon and negative height density are
 * things scenes really set.
 */

import type { PropertyValidator } from '../../linter/ValidatorRegistry.js';
import { v } from '../../linter/validators/index.js';

export const fogKeys: Record<string, PropertyValidator> = {
  fog_enabled: v.boolean('fog_enabled'),
  // environment.cpp:1492, set_fog_mode (:778-786) bare-assigns.
  fog_mode: v.enumInt(
    'fog_mode',
    0,
    1,
    { 0: 'EXPONENTIAL', 1: 'DEPTH' },
    { hinted: 'environment.cpp:1492' }
  ),
  fog_light_color: v.color('fog_light_color'),
  // environment.cpp:1494-1495 and :1497, all `or_greater`: floor only.
  fog_light_energy: v.nonNegativeFloat('fog_light_energy', { hinted: 'environment.cpp:1494' }),
  fog_sun_scatter: v.nonNegativeFloat('fog_sun_scatter', { hinted: 'environment.cpp:1495' }),
  fog_density: v.nonNegativeFloat('fog_density', { hinted: 'environment.cpp:1497' }),
  // environment.cpp:1498-1499
  fog_aerial_perspective: v.float('fog_aerial_perspective', {
    min: 0,
    max: 1,
    hinted: 'environment.cpp:1498',
  }),
  fog_sky_affect: v.float('fog_sky_affect', { min: 0, max: 1, hinted: 'environment.cpp:1499' }),
  // environment.cpp:1500-1501 and :1504-1505 open both ends; :1503 is EXP_EASING.
  fog_height: v.float('fog_height'),
  fog_height_density: v.float('fog_height_density'),
  fog_depth_curve: v.float('fog_depth_curve'),
  fog_depth_begin: v.float('fog_depth_begin'),
  fog_depth_end: v.float('fog_depth_end'),

  volumetric_fog_enabled: v.boolean('volumetric_fog_enabled'),
  // environment.cpp:1536, :1539 and :1542, all `or_greater`: floor only.
  volumetric_fog_density: v.nonNegativeFloat('volumetric_fog_density', {
    hinted: 'environment.cpp:1536',
  }),
  volumetric_fog_albedo: v.color('volumetric_fog_albedo'),
  volumetric_fog_emission: v.color('volumetric_fog_emission'),
  volumetric_fog_emission_energy: v.nonNegativeFloat('volumetric_fog_emission_energy', {
    hinted: 'environment.cpp:1539',
  }),
  volumetric_fog_length: v.float('volumetric_fog_length', {
    min: 0.01,
    hinted: 'environment.cpp:1542',
  }),
  // environment.cpp:1540 and :1544 ("0.0,16,0.01,exp"): `exp` scales the slider,
  // it does not open an end.
  volumetric_fog_gi_inject: v.float('volumetric_fog_gi_inject', {
    min: 0,
    max: 16,
    hinted: 'environment.cpp:1540',
  }),
  volumetric_fog_ambient_inject: v.float('volumetric_fog_ambient_inject', {
    min: 0,
    max: 16,
    hinted: 'environment.cpp:1544',
  }),
  // environment.cpp:1541
  volumetric_fog_anisotropy: v.float('volumetric_fog_anisotropy', {
    min: -0.9,
    max: 0.9,
    hinted: 'environment.cpp:1541',
  }),
  // EXP_EASING states no range, but CLAMP(p, 0.5, 6.0) at :982 alters the value.
  volumetric_fog_detail_spread: v.float('volumetric_fog_detail_spread', {
    min: 0.5,
    max: 6,
    enforced: 'environment.cpp:982',
  }),
  // environment.cpp:1545
  volumetric_fog_sky_affect: v.float('volumetric_fog_sky_affect', {
    min: 0,
    max: 1,
    hinted: 'environment.cpp:1545',
  }),
  volumetric_fog_temporal_reprojection_enabled: v.boolean(
    'volumetric_fog_temporal_reprojection_enabled'
  ),
  // environment.cpp:1548 ("0.5,0.99,0.001")
  volumetric_fog_temporal_reprojection_amount: v.float(
    'volumetric_fog_temporal_reprojection_amount',
    { min: 0.5, max: 0.99, hinted: 'environment.cpp:1548' }
  ),
};
