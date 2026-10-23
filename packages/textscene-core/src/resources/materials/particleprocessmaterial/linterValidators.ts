/**
 * ParticleProcessMaterial property validation: every stored member in `_bind_methods`
 * (`scene/resources/particle_process_material.cpp:2057-2317`). Each setter assigns bare, so a ranged
 * hint only warns. The two exceptions are `set_emission_shape`, which refuses an index past the enum
 * (`:1630`), and the `Parameter` index of the `_min`, `_max` and curve setters (`:1296`, `:1370`,
 * `:1457`), which no `.tscn` key reaches. A min or max stem is registered under the range string of
 * its `ADD_MIN_MAX_PROPERTY` line (`:2202-2205`), and its Vector2 stem is editor-only, so no key.
 */

// Registers Material, so the inherited keys resolve when this module loads alone.
import '../material/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import {
  PARTICLE_COLLISION_MODE_NAMES,
  PARTICLE_EMISSION_SHAPE_NAMES,
  PARTICLE_SUB_EMITTER_MODE_NAMES,
} from '../../../godot/scene/particles3d.js';

const SOURCE = 'particle_process_material.cpp';

validatorRegistry.registerAll('ParticleProcessMaterial', {
  // :2207 "0,1,0.01". set_lifetime_randomness:1865 is bare.
  lifetime_randomness: v.float('lifetime_randomness', { min: 0, max: 1, hinted: `${SOURCE}:2207` }),

  // :2209-2212: plain BOOL each, through set_particle_flag:1579, which guards the flag index alone.
  particle_flag_align_y: v.boolean('particle_flag_align_y'),
  particle_flag_rotate_y: v.boolean('particle_flag_rotate_y'),
  particle_flag_disable_z: v.boolean('particle_flag_disable_z'),
  particle_flag_damping_as_friction: v.boolean('particle_flag_damping_as_friction'),

  // :2215-2216: VECTOR3, no hint. set_emission_shape_offset:1772 and set_emission_shape_scale:1784
  // are bare, so a zero or negative scale loads.
  emission_shape_offset: v.vector3('emission_shape_offset'),
  emission_shape_scale: v.vector3('emission_shape_scale'),
  // :2217 ENUM "Point,Sphere,Sphere Surface,Box,Points,Directed Points,Ring". set_emission_shape:1630
  // refuses an index past EMISSION_SHAPE_MAX with ERR_FAIL_INDEX.
  emission_shape: v.enumInt('emission_shape', PARTICLE_EMISSION_SHAPE_NAMES, { enforced: `${SOURCE}:1630` }),
  // :2218 "0.01,128,0.01,or_greater". set_emission_sphere_radius:1639 is bare.
  emission_sphere_radius: v.float('emission_sphere_radius', { min: 0.01, hinted: `${SOURCE}:2218` }),
  // :2219: VECTOR3, no hint. set_emission_box_extents:1647 is bare.
  emission_box_extents: v.vector3('emission_box_extents'),
  // :2220-2222: RESOURCE_TYPE "Texture2D" each. The setters (:1655-1667) take any Texture2D.
  emission_point_texture: v.resourceReference('emission_point_texture'),
  emission_normal_texture: v.resourceReference('emission_normal_texture'),
  emission_color_texture: v.resourceReference('emission_color_texture'),
  // :2223 "0,1000000,1". set_emission_point_count:1674 is bare.
  emission_point_count: v.int('emission_point_count', { min: 0, max: 1000000, hinted: `${SOURCE}:2223` }),
  // :2224: VECTOR3, no hint. set_emission_ring_axis:1679 is bare.
  emission_ring_axis: v.vector3('emission_ring_axis'),
  // :2225-2227 "0,1000,0.01,or_greater". set_emission_ring_height:1687, _radius:1695 and
  // _inner_radius:1703 are bare.
  emission_ring_height: v.nonNegativeFloat('emission_ring_height', { hinted: `${SOURCE}:2225` }),
  emission_ring_radius: v.nonNegativeFloat('emission_ring_radius', { hinted: `${SOURCE}:2226` }),
  emission_ring_inner_radius: v.nonNegativeFloat('emission_ring_inner_radius', { hinted: `${SOURCE}:2227` }),
  // :2228 "0,90,0.01,degrees": `degrees` is a suffix, not radians_as_degrees, so the key holds degrees.
  // set_emission_ring_cone_angle:1711 is bare.
  emission_ring_cone_angle: v.float('emission_ring_cone_angle', {
    min: 0,
    max: 90,
    hinted: `${SOURCE}:2228`,
  }),

  // :2230 "-720,720,0.1,or_less,or_greater,degrees": both ends open.
  angle_min: v.float('angle_min'),
  angle_max: v.float('angle_max'),
  // :2231: RESOURCE_TYPE "CurveTexture".
  angle_curve: v.resourceReference('angle_curve'),

  // :2233 "0.0,1.0,0.001,or_less,or_greater": both ends open. set_inherit_velocity_ratio:1719 is bare.
  inherit_velocity_ratio: v.float('inherit_velocity_ratio'),
  // :2234-2235: VECTOR3, no hint. set_velocity_pivot:1277 and set_direction:1250 are bare.
  velocity_pivot: v.vector3('velocity_pivot'),
  direction: v.vector3('direction'),
  // :2236 "0,180,0.001". set_spread:1259 is bare.
  spread: v.float('spread', { min: 0, max: 180, hinted: `${SOURCE}:2236` }),
  // :2237 "0,1,0.001". set_flatness:1268 is bare.
  flatness: v.float('flatness', { min: 0, max: 1, hinted: `${SOURCE}:2237` }),
  // :2238 "0,1000,0.01,or_less,or_greater": both ends open.
  initial_velocity_min: v.float('initial_velocity_min'),
  initial_velocity_max: v.float('initial_velocity_max'),

  // :2242 "-720,720,0.01,or_less,or_greater": both ends open. :2243: RESOURCE_TYPE "CurveTexture".
  angular_velocity_min: v.float('angular_velocity_min'),
  angular_velocity_max: v.float('angular_velocity_max'),
  angular_velocity_curve: v.resourceReference('angular_velocity_curve'),
  // :2245 "-720,720,0.01,or_less,or_greater": both ends open. :2246: RESOURCE_TYPE "CurveXYZTexture".
  directional_velocity_min: v.float('directional_velocity_min'),
  directional_velocity_max: v.float('directional_velocity_max'),
  directional_velocity_curve: v.resourceReference('directional_velocity_curve'),
  // :2248 "-2,2,0.001,or_less,or_greater": both ends open. :2249: RESOURCE_TYPE "CurveTexture,CurveXYZTexture".
  orbit_velocity_min: v.float('orbit_velocity_min'),
  orbit_velocity_max: v.float('orbit_velocity_max'),
  orbit_velocity_curve: v.resourceReference('orbit_velocity_curve'),
  // :2251 "-1000,1000,0.01,or_less,or_greater": both ends open. :2252: RESOURCE_TYPE "CurveTexture".
  radial_velocity_min: v.float('radial_velocity_min'),
  radial_velocity_max: v.float('radial_velocity_max'),
  radial_velocity_curve: v.resourceReference('radial_velocity_curve'),
  // :2254: RESOURCE_TYPE "CurveTexture". set_velocity_limit_curve:1612 takes any Texture2D.
  velocity_limit_curve: v.resourceReference('velocity_limit_curve'),

  // :2257: VECTOR3, no hint. set_gravity:1852 is bare.
  gravity: v.vector3('gravity'),
  // :2259 "-100,100,0.01,or_less,or_greater": both ends open. :2260: RESOURCE_TYPE "CurveTexture".
  linear_accel_min: v.float('linear_accel_min'),
  linear_accel_max: v.float('linear_accel_max'),
  linear_accel_curve: v.resourceReference('linear_accel_curve'),
  // :2262 "-100,100,0.01,or_less,or_greater": both ends open. :2263: RESOURCE_TYPE "CurveTexture".
  radial_accel_min: v.float('radial_accel_min'),
  radial_accel_max: v.float('radial_accel_max'),
  radial_accel_curve: v.resourceReference('radial_accel_curve'),
  // :2265 "-100,100,0.01,or_less,or_greater": both ends open. :2266: RESOURCE_TYPE "CurveTexture".
  tangential_accel_min: v.float('tangential_accel_min'),
  tangential_accel_max: v.float('tangential_accel_max'),
  tangential_accel_curve: v.resourceReference('tangential_accel_curve'),
  // :2268 "0,100,0.001,or_greater". :2269: RESOURCE_TYPE "CurveTexture".
  damping_min: v.nonNegativeFloat('damping_min', { hinted: `${SOURCE}:2268` }),
  damping_max: v.nonNegativeFloat('damping_max', { hinted: `${SOURCE}:2268` }),
  damping_curve: v.resourceReference('damping_curve'),
  // :2271: plain BOOL. set_attractor_interaction_enabled:2007 is bare.
  attractor_interaction_enabled: v.boolean('attractor_interaction_enabled'),

  // :2275 "0,1000,0.01,or_greater". :2276: RESOURCE_TYPE "CurveTexture,CurveXYZTexture".
  scale_min: v.nonNegativeFloat('scale_min', { hinted: `${SOURCE}:2275` }),
  scale_max: v.nonNegativeFloat('scale_max', { hinted: `${SOURCE}:2275` }),
  scale_curve: v.resourceReference('scale_curve'),
  // :2278 "0,1000,0.01,or_greater". :2279: RESOURCE_TYPE "CurveTexture,CurveXYZTexture".
  scale_over_velocity_min: v.nonNegativeFloat('scale_over_velocity_min', { hinted: `${SOURCE}:2278` }),
  scale_over_velocity_max: v.nonNegativeFloat('scale_over_velocity_max', { hinted: `${SOURCE}:2278` }),
  scale_over_velocity_curve: v.resourceReference('scale_over_velocity_curve'),

  // :2282: COLOR, no hint. set_color:1546 is bare.
  color: v.color('color'),
  // :2283-2286: RESOURCE_TYPE "GradientTexture1D" for the two ramps, "CurveTexture" for the two curves.
  color_ramp: v.resourceReference('color_ramp'),
  color_initial_ramp: v.resourceReference('color_initial_ramp'),
  alpha_curve: v.resourceReference('alpha_curve'),
  emission_curve: v.resourceReference('emission_curve'),
  // :2288 "-1,1,0.01". :2289: RESOURCE_TYPE "CurveTexture".
  hue_variation_min: v.float('hue_variation_min', { min: -1, max: 1, hinted: `${SOURCE}:2288` }),
  hue_variation_max: v.float('hue_variation_max', { min: -1, max: 1, hinted: `${SOURCE}:2288` }),
  hue_variation_curve: v.resourceReference('hue_variation_curve'),
  // :2291 "0,16,0.01,or_less,or_greater": both ends open. :2292: RESOURCE_TYPE "CurveTexture".
  anim_speed_min: v.float('anim_speed_min'),
  anim_speed_max: v.float('anim_speed_max'),
  anim_speed_curve: v.resourceReference('anim_speed_curve'),
  // :2293 "0,1,0.0001". :2294: RESOURCE_TYPE "CurveTexture".
  anim_offset_min: v.float('anim_offset_min', { min: 0, max: 1, hinted: `${SOURCE}:2293` }),
  anim_offset_max: v.float('anim_offset_max', { min: 0, max: 1, hinted: `${SOURCE}:2293` }),
  anim_offset_curve: v.resourceReference('anim_offset_curve'),

  // :2297: BOOL with PROPERTY_HINT_GROUP_ENABLE, which is an inspector group header, not a range.
  turbulence_enabled: v.boolean('turbulence_enabled'),
  // :2298 "0,20,0.01". set_turbulence_noise_strength:1811 is bare.
  turbulence_noise_strength: v.float('turbulence_noise_strength', {
    min: 0,
    max: 20,
    hinted: `${SOURCE}:2298`,
  }),
  // :2299 "0,10,0.001,or_greater". set_turbulence_noise_scale:1820 stores the value as written.
  turbulence_noise_scale: v.nonNegativeFloat('turbulence_noise_scale', { hinted: `${SOURCE}:2299` }),
  // :2300: VECTOR3, no hint. set_turbulence_noise_speed:1843 is bare.
  turbulence_noise_speed: v.vector3('turbulence_noise_speed'),
  // :2301 "0,4,0.01". set_turbulence_noise_speed_random:1834 is bare.
  turbulence_noise_speed_random: v.float('turbulence_noise_speed_random', {
    min: 0,
    max: 4,
    hinted: `${SOURCE}:2301`,
  }),
  // :2302 "0,1,0.001" and :2303 "-100,100,0.1", through set_param_min and set_param_max (:1295, :1369).
  turbulence_influence_min: v.float('turbulence_influence_min', { min: 0, max: 1, hinted: `${SOURCE}:2302` }),
  turbulence_influence_max: v.float('turbulence_influence_max', { min: 0, max: 1, hinted: `${SOURCE}:2302` }),
  turbulence_initial_displacement_min: v.float('turbulence_initial_displacement_min', {
    min: -100,
    max: 100,
    hinted: `${SOURCE}:2303`,
  }),
  turbulence_initial_displacement_max: v.float('turbulence_initial_displacement_max', {
    min: -100,
    max: 100,
    hinted: `${SOURCE}:2303`,
  }),
  // :2304: RESOURCE_TYPE "CurveTexture".
  turbulence_influence_over_life: v.resourceReference('turbulence_influence_over_life'),

  // :2307 ENUM "Disabled,Rigid,Hide On Contact". set_collision_mode:2016 is bare.
  collision_mode: v.enumInt('collision_mode', PARTICLE_COLLISION_MODE_NAMES, { hinted: `${SOURCE}:2307` }),
  // :2308-2309 "0,1,0.01". set_collision_friction:2035 and set_collision_bounce:2044 are bare.
  collision_friction: v.float('collision_friction', { min: 0, max: 1, hinted: `${SOURCE}:2308` }),
  collision_bounce: v.float('collision_bounce', { min: 0, max: 1, hinted: `${SOURCE}:2309` }),
  // :2310: plain BOOL. set_collision_use_scale:2026 is bare.
  collision_use_scale: v.boolean('collision_use_scale'),

  // :2312 ENUM "Disabled:0,Constant:1,At Start:4,At End:2,At Collision:3", which names every
  // SubEmitterMode (:93-100). set_sub_emitter_mode:1950 is bare.
  sub_emitter_mode: v.enumInt('sub_emitter_mode', PARTICLE_SUB_EMITTER_MODE_NAMES, {
    hinted: `${SOURCE}:2312`,
  }),
  // :2313 "0.01,100,0.01,suffix:Hz". set_sub_emitter_frequency:1963 is bare.
  sub_emitter_frequency: v.float('sub_emitter_frequency', { min: 0.01, max: 100, hinted: `${SOURCE}:2313` }),
  // :2314-2316 "1,32,1". The three amount setters (:1972, :1981, :1990) are bare.
  sub_emitter_amount_at_end: v.int('sub_emitter_amount_at_end', {
    min: 1,
    max: 32,
    hinted: `${SOURCE}:2314`,
  }),
  sub_emitter_amount_at_collision: v.int('sub_emitter_amount_at_collision', {
    min: 1,
    max: 32,
    hinted: `${SOURCE}:2315`,
  }),
  sub_emitter_amount_at_start: v.int('sub_emitter_amount_at_start', {
    min: 1,
    max: 32,
    hinted: `${SOURCE}:2316`,
  }),
  // :2317: plain BOOL. set_sub_emitter_keep_velocity:1999 is bare.
  sub_emitter_keep_velocity: v.boolean('sub_emitter_keep_velocity'),
});
