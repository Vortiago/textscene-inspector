/**
 * CPUParticles3D strict validators for linting: only its own members, the ones
 * doc/classes/CPUParticles3D.xml lists without `overrides=`. The NODE_BASE_TYPES
 * base-walk delivers everything from GeometryInstance3D up, so re-declaring an
 * inherited key shadows it and duplicates the rule.
 */

import '../../geometryinstance3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const DRAW_ORDER = { 0: 'INDEX', 1: 'LIFETIME', 2: 'VIEW_DEPTH' };

const EMISSION_SHAPE = {
  0: 'POINT',
  1: 'SPHERE',
  2: 'SPHERE_SURFACE',
  3: 'BOX',
  4: 'POINTS',
  5: 'DIRECTED_POINTS',
  6: 'RING',
};

// Every member is an `ADD_PROPERTY*` in `cpu_particles_3d.cpp`'s `_bind_methods` (lines
// 1555-1742) with a setter and a getter, so none is skipped. Each cite quotes that line.
validatorRegistry.registerAll('CPUParticles3D', {
  // cpu_particles_3d.cpp:1555: PROPERTY_HINT_ONESHOT is an editor icon hint, not a range.
  emitting: v.boolean('emitting'),
  // cpu_particles_3d.cpp:1556: "1,1000000,1,exp". set_amount:71-74 refuses p_amount < 1 with
  // ERR_FAIL_COND_MSG but never checks the ceiling, so the ceiling only warns.
  amount: v.int('amount', {
    min: 1,
    max: 1000000,
    enforced: { min: 'cpu_particles_3d.cpp:72' },
    hinted: { max: 'cpu_particles_3d.cpp:1556' },
  }),

  // cpu_particles_3d.cpp:1557: ADD_GROUP("Time", "").
  // cpu_particles_3d.cpp:1558: "0.01,600.0,0.01,or_greater,exp,suffix:s". set_lifetime (:92)
  // refuses p_lifetime <= 0, so a value in (0, 0.01) loads into Godot and only warns.
  lifetime: v.positiveFloat('lifetime', undefined, {
    min: 0.01,
    enforced: 'cpu_particles_3d.cpp:92',
    hinted: 'cpu_particles_3d.cpp:1558',
  }),
  // cpu_particles_3d.cpp:1559: plain BOOL.
  one_shot: v.boolean('one_shot'),
  // cpu_particles_3d.cpp:1560: "0.00,10.0,0.01,or_greater,exp,suffix:s".
  // set_pre_process_time:100-103 is a bare assignment.
  preprocess: v.nonNegativeFloat('preprocess', { hinted: 'cpu_particles_3d.cpp:1560' }),

  // cpu_particles_3d.cpp:1562: "0,64,0.01". set_speed_scale:126-128 is a bare assignment.
  speed_scale: v.float('speed_scale', { min: 0, max: 64, hinted: 'cpu_particles_3d.cpp:1562' }),
  // cpu_particles_3d.cpp:1563: "0,1,0.01". set_explosiveness_ratio:104-107 is bare.
  explosiveness: v.float('explosiveness', {
    min: 0,
    max: 1,
    hinted: 'cpu_particles_3d.cpp:1563',
  }),
  // cpu_particles_3d.cpp:1564: "0,1,0.01". set_randomness_ratio:108-111 is bare.
  randomness: v.float('randomness', { min: 0, max: 1, hinted: 'cpu_particles_3d.cpp:1564' }),
  // cpu_particles_3d.cpp:1565: plain BOOL.
  use_fixed_seed: v.boolean('use_fixed_seed'),
  // cpu_particles_3d.cpp:1566: a PROPERTY_HINT_RANGE "0,"+UINT32_MAX+",1" that states its
  // numbers, unlike a LAYERS hint. set_seed:578-580 is a bare assignment.
  seed: v.int('seed', { min: 0, max: 4294967295, hinted: 'cpu_particles_3d.cpp:1566' }),
  // cpu_particles_3d.cpp:1567: "0,1,0.01". set_lifetime_randomness:118-121 is bare.
  lifetime_randomness: v.float('lifetime_randomness', {
    min: 0,
    max: 1,
    hinted: 'cpu_particles_3d.cpp:1567',
  }),
  // cpu_particles_3d.cpp:1568: "0,1000,1,suffix:FPS". set_fixed_fps:198-200 is a bare assignment.
  fixed_fps: v.int('fixed_fps', { min: 0, max: 1000, hinted: 'cpu_particles_3d.cpp:1568' }),
  // cpu_particles_3d.cpp:1569: plain BOOL.
  fract_delta: v.boolean('fract_delta'),

  // cpu_particles_3d.cpp:1570: ADD_GROUP("Drawing", "").
  // cpu_particles_3d.cpp:1571: PROPERTY_HINT_NONE, "suffix:m", so format-only.
  visibility_aabb: v.aabb('visibility_aabb'),
  // cpu_particles_3d.cpp:1572: plain BOOL.
  local_coords: v.boolean('local_coords'),
  // cpu_particles_3d.cpp:1573: PROPERTY_HINT_ENUM "Index,Lifetime,View Depth". set_draw_order
  // (cpu_particles_3d.cpp:175) refuses outside 0-2 with ERR_FAIL_INDEX. CPUParticles2D's setter
  // takes any int, so its draw_order stays unvalidated.
  draw_order: v.enumInt('draw_order', 0, 2, DRAW_ORDER, { enforced: 'cpu_particles_3d.cpp:175' }),
  // cpu_particles_3d.cpp:1574: PROPERTY_HINT_RESOURCE_TYPE "Mesh".
  mesh: v.resourceReference('mesh'),

  // cpu_particles_3d.cpp:1666: ADD_GROUP("Emission Shape", "emission_").
  // cpu_particles_3d.cpp:1667: PROPERTY_HINT_ENUM, Point..Ring. set_emission_shape:423-426
  // refuses with ERR_FAIL_INDEX(p_shape, EMISSION_SHAPE_MAX).
  emission_shape: v.enumInt('emission_shape', 0, 6, EMISSION_SHAPE, {
    enforced: 'cpu_particles_3d.cpp:424',
  }),
  // cpu_particles_3d.cpp:1668: "0.01,128,0.01". set_emission_sphere_radius:429-432 is bare.
  emission_sphere_radius: v.float('emission_sphere_radius', {
    min: 0.01,
    max: 128,
    hinted: 'cpu_particles_3d.cpp:1668',
  }),
  // cpu_particles_3d.cpp:1669: VECTOR3, no hint.
  emission_box_extents: v.vector3('emission_box_extents'),
  // cpu_particles_3d.cpp:1670. The three packed arrays have no hint and bare setters
  // (cpu_particles_3d.cpp:439-449), so the check is format-only, as in `_parse_construct`
  // (variant_parser.cpp:552-596): float literals, with `inf`, `-inf`, `inf_neg` and `nan`.
  emission_points: v.packedVector3Array('emission_points'),
  // cpu_particles_3d.cpp:1671, set_emission_normals:443-445. `parse_value` divides the float
  // count by the arity and drops the remainder with no error, so `PackedVector3Array(0, 0, 1, 0)`
  // loads as one Vector3 (variant_parser.cpp:1573 Vector3Array, :1609 ColorArray).
  emission_normals: v.packedVector3Array('emission_normals'),
  // cpu_particles_3d.cpp:1672, set_emission_colors:447-449.
  emission_colors: v.packedColorArray('emission_colors'),
  // cpu_particles_3d.cpp:1673: VECTOR3, no hint.
  emission_ring_axis: v.vector3('emission_ring_axis'),
  // cpu_particles_3d.cpp:1674: "0,1000,0.01,or_greater". set_emission_ring_height:456-459 is bare.
  emission_ring_height: v.nonNegativeFloat('emission_ring_height', {
    hinted: 'cpu_particles_3d.cpp:1674',
  }),
  // cpu_particles_3d.cpp:1675: "0,1000,0.01,or_greater". set_emission_ring_radius:461-464 is bare.
  emission_ring_radius: v.nonNegativeFloat('emission_ring_radius', {
    hinted: 'cpu_particles_3d.cpp:1675',
  }),
  // cpu_particles_3d.cpp:1676: "0,1000,0.01,or_greater". set_emission_ring_inner_radius:466-469
  // is bare.
  emission_ring_inner_radius: v.nonNegativeFloat('emission_ring_inner_radius', {
    hinted: 'cpu_particles_3d.cpp:1676',
  }),
  // cpu_particles_3d.cpp:1677: "0,90,0.01,degrees". The process code reads the value as degrees
  // (cpu_particles_3d.cpp:945), not `radians_as_degrees`, so no `v.radians` conversion applies.
  // set_emission_ring_cone_angle:471-474 is bare.
  emission_ring_cone_angle: v.float('emission_ring_cone_angle', {
    min: 0,
    max: 90,
    hinted: 'cpu_particles_3d.cpp:1677',
  }),

  // cpu_particles_3d.cpp:1678: ADD_GROUP("Particle Flags", "particle_flag_").
  // cpu_particles_3d.cpp:1679-1681: plain BOOL each.
  particle_flag_align_y: v.boolean('particle_flag_align_y'),
  particle_flag_rotate_y: v.boolean('particle_flag_rotate_y'),
  particle_flag_disable_z: v.boolean('particle_flag_disable_z'),

  // cpu_particles_3d.cpp:1682: ADD_GROUP("Direction", "").
  // cpu_particles_3d.cpp:1683: VECTOR3, no hint.
  direction: v.vector3('direction'),
  // cpu_particles_3d.cpp:1684: "0,180,0.01". set_spread:274-277 is a bare assignment.
  spread: v.float('spread', { min: 0, max: 180, hinted: 'cpu_particles_3d.cpp:1684' }),
  // cpu_particles_3d.cpp:1685: "0,1,0.01". set_flatness:282-285 is a bare assignment.
  flatness: v.float('flatness', { min: 0, max: 1, hinted: 'cpu_particles_3d.cpp:1685' }),

  // cpu_particles_3d.cpp:1686: ADD_GROUP("Gravity", "").
  // cpu_particles_3d.cpp:1687: VECTOR3, no hint.
  gravity: v.vector3('gravity'),

  // cpu_particles_3d.cpp:1688: ADD_GROUP("Initial Velocity", "initial_").
  // cpu_particles_3d.cpp:1689-1690: "0,1000,0.01,or_greater". set_param_min/set_param_max
  // (cpu_particles_3d.cpp:290-315) guard the param index with ERR_FAIL_INDEX, never the value.
  initial_velocity_min: v.nonNegativeFloat('initial_velocity_min', {
    hinted: 'cpu_particles_3d.cpp:1689',
  }),
  initial_velocity_max: v.nonNegativeFloat('initial_velocity_max', {
    hinted: 'cpu_particles_3d.cpp:1690',
  }),

  // cpu_particles_3d.cpp:1691: ADD_GROUP("Angular Velocity", "angular_").
  // cpu_particles_3d.cpp:1692-1693: "-720,720,0.01,or_less,or_greater", so both ends are open.
  angular_velocity_min: v.float('angular_velocity_min'),
  angular_velocity_max: v.float('angular_velocity_max'),
  // cpu_particles_3d.cpp:1694: PROPERTY_HINT_RESOURCE_TYPE "Curve".
  angular_velocity_curve: v.resourceReference('angular_velocity_curve'),

  // cpu_particles_3d.cpp:1695: ADD_GROUP("Orbit Velocity", "orbit_").
  // cpu_particles_3d.cpp:1696-1697: "-1000,1000,0.01,or_less,or_greater", so both ends are open.
  orbit_velocity_min: v.float('orbit_velocity_min'),
  orbit_velocity_max: v.float('orbit_velocity_max'),
  // cpu_particles_3d.cpp:1698: PROPERTY_HINT_RESOURCE_TYPE "Curve".
  orbit_velocity_curve: v.resourceReference('orbit_velocity_curve'),

  // cpu_particles_3d.cpp:1699: ADD_GROUP("Linear Accel", "linear_").
  // cpu_particles_3d.cpp:1700-1701: "-100,100,0.01,or_less,or_greater", so both ends are open.
  linear_accel_min: v.float('linear_accel_min'),
  linear_accel_max: v.float('linear_accel_max'),
  // cpu_particles_3d.cpp:1702: PROPERTY_HINT_RESOURCE_TYPE "Curve".
  linear_accel_curve: v.resourceReference('linear_accel_curve'),

  // cpu_particles_3d.cpp:1703: ADD_GROUP("Radial Accel", "radial_").
  // cpu_particles_3d.cpp:1704-1705: "-100,100,0.01,or_less,or_greater", so both ends are open.
  radial_accel_min: v.float('radial_accel_min'),
  radial_accel_max: v.float('radial_accel_max'),
  // cpu_particles_3d.cpp:1706: PROPERTY_HINT_RESOURCE_TYPE "Curve".
  radial_accel_curve: v.resourceReference('radial_accel_curve'),

  // cpu_particles_3d.cpp:1707: ADD_GROUP("Tangential Accel", "tangential_").
  // cpu_particles_3d.cpp:1708-1709: "-100,100,0.01,or_less,or_greater", so both ends are open.
  tangential_accel_min: v.float('tangential_accel_min'),
  tangential_accel_max: v.float('tangential_accel_max'),
  // cpu_particles_3d.cpp:1710: PROPERTY_HINT_RESOURCE_TYPE "Curve".
  tangential_accel_curve: v.resourceReference('tangential_accel_curve'),

  // cpu_particles_3d.cpp:1711: ADD_GROUP("Damping", "").
  // cpu_particles_3d.cpp:1712-1713: "0,100,0.001,or_greater", through set_param_min/max.
  damping_min: v.nonNegativeFloat('damping_min', { hinted: 'cpu_particles_3d.cpp:1712' }),
  damping_max: v.nonNegativeFloat('damping_max', { hinted: 'cpu_particles_3d.cpp:1713' }),
  // cpu_particles_3d.cpp:1714: PROPERTY_HINT_RESOURCE_TYPE "Curve".
  damping_curve: v.resourceReference('damping_curve'),

  // cpu_particles_3d.cpp:1715: ADD_GROUP("Angle", "").
  // cpu_particles_3d.cpp:1716-1717: "-720,720,0.1,or_less,or_greater,degrees", so both ends are
  // open.
  angle_min: v.float('angle_min'),
  angle_max: v.float('angle_max'),
  // cpu_particles_3d.cpp:1718: PROPERTY_HINT_RESOURCE_TYPE "Curve".
  angle_curve: v.resourceReference('angle_curve'),

  // cpu_particles_3d.cpp:1719: ADD_GROUP("Scale", "").
  // cpu_particles_3d.cpp:1720-1721: "0,1000,0.01,or_greater", through set_param_min/max.
  scale_amount_min: v.nonNegativeFloat('scale_amount_min', {
    hinted: 'cpu_particles_3d.cpp:1720',
  }),
  scale_amount_max: v.nonNegativeFloat('scale_amount_max', {
    hinted: 'cpu_particles_3d.cpp:1721',
  }),
  // cpu_particles_3d.cpp:1722: PROPERTY_HINT_RESOURCE_TYPE "Curve".
  scale_amount_curve: v.resourceReference('scale_amount_curve'),
  // cpu_particles_3d.cpp:1723: plain BOOL.
  split_scale: v.boolean('split_scale'),
  // cpu_particles_3d.cpp:1724-1726: PROPERTY_HINT_RESOURCE_TYPE "Curve" each.
  scale_curve_x: v.resourceReference('scale_curve_x'),
  scale_curve_y: v.resourceReference('scale_curve_y'),
  scale_curve_z: v.resourceReference('scale_curve_z'),

  // cpu_particles_3d.cpp:1727: ADD_GROUP("Color", "").
  // cpu_particles_3d.cpp:1728: COLOR, no hint.
  color: v.color('color'),
  // cpu_particles_3d.cpp:1729-1730: PROPERTY_HINT_RESOURCE_TYPE "Gradient" each.
  color_ramp: v.resourceReference('color_ramp'),
  color_initial_ramp: v.resourceReference('color_initial_ramp'),

  // cpu_particles_3d.cpp:1732: ADD_GROUP("Hue Variation", "hue_").
  // cpu_particles_3d.cpp:1733-1734: "-1,1,0.01", through set_param_min/max, which never checks
  // the value, so the closed hint only warns.
  hue_variation_min: v.float('hue_variation_min', {
    min: -1,
    max: 1,
    hinted: 'cpu_particles_3d.cpp:1733',
  }),
  hue_variation_max: v.float('hue_variation_max', {
    min: -1,
    max: 1,
    hinted: 'cpu_particles_3d.cpp:1734',
  }),
  // cpu_particles_3d.cpp:1735: PROPERTY_HINT_RESOURCE_TYPE "Curve".
  hue_variation_curve: v.resourceReference('hue_variation_curve'),

  // cpu_particles_3d.cpp:1736: ADD_GROUP("Animation", "anim_").
  // cpu_particles_3d.cpp:1737-1738: "0,128,0.01,or_greater,or_less", so both ends are open.
  anim_speed_min: v.float('anim_speed_min'),
  anim_speed_max: v.float('anim_speed_max'),
  // cpu_particles_3d.cpp:1739: PROPERTY_HINT_RESOURCE_TYPE "Curve".
  anim_speed_curve: v.resourceReference('anim_speed_curve'),
  // cpu_particles_3d.cpp:1740-1741: "0,1,0.0001", through set_param_min/max, so it only warns.
  anim_offset_min: v.float('anim_offset_min', {
    min: 0,
    max: 1,
    hinted: 'cpu_particles_3d.cpp:1740',
  }),
  anim_offset_max: v.float('anim_offset_max', {
    min: 0,
    max: 1,
    hinted: 'cpu_particles_3d.cpp:1741',
  }),
  // cpu_particles_3d.cpp:1742: PROPERTY_HINT_RESOURCE_TYPE "Curve".
  anim_offset_curve: v.resourceReference('anim_offset_curve'),
});
