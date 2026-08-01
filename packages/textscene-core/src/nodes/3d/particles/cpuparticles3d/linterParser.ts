/**
 * CPUParticles3D strict validators for linting.
 *
 * Declare only CPUParticles3D's OWN members — the ones doc/classes/CPUParticles3D.xml
 * lists without an `overrides=` attribute. Everything from GeometryInstance3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * All 77 members come straight from `cpu_particles_3d.cpp`'s `_bind_methods`
 * (lines 1555-1742), every one an `ADD_PROPERTY`/`ADD_PROPERTYI` with both a
 * setter and a getter (no `PROPERTY_USAGE_NONE`, no getter-only entry, no
 * `overrides=` in the XML), so none is skipped by rules 3/4. Citations below
 * quote the exact `ADD_PROPERTY*` line.
 *
 * Bound convention: a `PROPERTY_HINT_RANGE` with `or_greater`/`or_less` makes
 * the stated extent on that side a soft editor-slider bound only — no cap is
 * enforced here. Its absence on a side makes that side the hard bound.
 *
 * `draw_order` gets a hard 0-2 enum bound (unlike CPUParticles2D's, which is
 * deliberately left unvalidated): CPUParticles2D::set_draw_order takes any int
 * unconditionally, but CPUParticles3D::set_draw_order calls
 * `ERR_FAIL_INDEX(p_order, DRAW_ORDER_MAX)` (cpu_particles_3d.cpp:175), so the
 * engine itself refuses an out-of-range value here.
 *
 * `emission_ring_cone_angle`'s hint token is a bare `degrees` (not
 * `radians_as_degrees`): the process code reads it directly as degrees
 * (`Math::deg_to_rad(90.0 - emission_ring_cone_angle)`, cpu_particles_3d.cpp:945),
 * so the serialised value IS degrees — no `v.radians` unit conversion applies,
 * unlike a `radians_as_degrees` hint.
 *
 * `emission_points`/`emission_normals` (PackedVector3Array) and
 * `emission_colors` (PackedColorArray) have no combinator in `v` yet, so this
 * file hand-rolls one generic tuple-array validator for both arities rather
 * than duplicating `v.packedVector2Array`'s body twice.
 */

import '../../geometryinstance3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v, accepts, propertyError } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

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

/**
 * `Packed<Kind>Array(n1, n2, …)` — an arbitrary-length list of fixed-size
 * TUPLES (3 floats per Vector3, 4 per Color), unlike `v.packedVector2Array`'s
 * hard-coded pair arity. The interesting failure a `groupSize` model catches
 * that a bare "any length" check would miss: a count that isn't a multiple of
 * `groupSize`, meaning a truncated final tuple — a value error, since the
 * grammar parsed fine and the content is short one or more components.
 *
 * Godot serialises an empty array as `Packed<Kind>Array()`, so zero values is
 * legal, same as `v.packedVector2Array`.
 */
function packedTupleArray(name: string, wrapper: string, groupSize: number, acceptsLabel: string): PropertyValidator {
  const formatErr = `INVALID_${name.toUpperCase()}_FORMAT`;
  const valueErr = `INVALID_${name.toUpperCase()}_VALUE`;
  const WRAPPER_RE = new RegExp(`^\\s*${wrapper}\\s*\\(([\\s\\S]*)\\)\\s*$`);
  return accepts((key, value, line) => {
    const match = WRAPPER_RE.exec(value);
    if (!match) {
      return propertyError(
        key,
        line,
        `Property '${name}' must be a ${wrapper} like ${wrapper}(${Array(groupSize).fill('0').join(', ')}), got: ${value}`,
        formatErr
      );
    }
    const body = match[1]!.trim();
    if (body === '') return null;

    const parts = body.split(',');
    for (const part of parts) {
      const n = Number(part.trim());
      if (part.trim() === '' || !Number.isFinite(n)) {
        return propertyError(
          key,
          line,
          `Property '${name}' contains a non-numeric value: "${part.trim()}"`,
          formatErr
        );
      }
    }
    if (parts.length % groupSize !== 0) {
      return propertyError(
        key,
        line,
        `Property '${name}' must contain groups of ${groupSize} values, got ${parts.length} (not a multiple of ${groupSize})`,
        valueErr
      );
    }
    return null;
  }, acceptsLabel);
}

function packedVector3Array(name: string): PropertyValidator {
  return packedTupleArray(name, 'PackedVector3Array', 3, 'PackedVector3Array(x, y, z, …) — multiple of 3');
}

function packedColorArray(name: string): PropertyValidator {
  return packedTupleArray(name, 'PackedColorArray', 4, 'PackedColorArray(r, g, b, a, …) — multiple of 4');
}

validatorRegistry.registerAll('CPUParticles3D', {
  // cpu_particles_3d.cpp:1555 — PROPERTY_HINT_ONESHOT is an editor icon hint, not a range.
  emitting: v.boolean('emitting'),
  // cpu_particles_3d.cpp:1556 — PROPERTY_HINT_RANGE "1,1000000,1,exp", no or_greater/or_less: hard both ends.
  amount: v.int('amount', { min: 1, max: 1000000 }),

  // ADD_GROUP("Time", "") — cpu_particles_3d.cpp:1557.
  // cpu_particles_3d.cpp:1558 — "0.01,600.0,0.01,or_greater,exp,suffix:s": or_greater lifts the 600 ceiling; 0.01 floor is hard.
  lifetime: v.float('lifetime', { min: 0.01 }),
  // cpu_particles_3d.cpp:1559 — plain BOOL, no hint.
  one_shot: v.boolean('one_shot'),
  // cpu_particles_3d.cpp:1560 — "0.00,10.0,0.01,or_greater,exp,suffix:s": or_greater lifts the 10 ceiling; 0 floor hard.
  preprocess: v.nonNegativeFloat('preprocess'),

  // cpu_particles_3d.cpp:1562 — "0,64,0.01", no or_greater/or_less: hard both ends.
  speed_scale: v.float('speed_scale', { min: 0, max: 64 }),
  // cpu_particles_3d.cpp:1563 — "0,1,0.01": hard both ends.
  explosiveness: v.float('explosiveness', { min: 0, max: 1 }),
  // cpu_particles_3d.cpp:1564 — "0,1,0.01": hard both ends.
  randomness: v.float('randomness', { min: 0, max: 1 }),
  // cpu_particles_3d.cpp:1565 — plain BOOL, no hint.
  use_fixed_seed: v.boolean('use_fixed_seed'),
  // cpu_particles_3d.cpp:1566 — "0,"+UINT32_MAX+",1": hard both ends (uint32_t setter param).
  seed: v.int('seed', { min: 0, max: 4294967295 }),
  // cpu_particles_3d.cpp:1567 — "0,1,0.01": hard both ends.
  lifetime_randomness: v.float('lifetime_randomness', { min: 0, max: 1 }),
  // cpu_particles_3d.cpp:1568 — "0,1000,1,suffix:FPS", no or_greater/or_less: hard both ends.
  fixed_fps: v.int('fixed_fps', { min: 0, max: 1000 }),
  // cpu_particles_3d.cpp:1569 — plain BOOL, no hint.
  fract_delta: v.boolean('fract_delta'),

  // ADD_GROUP("Drawing", "") — cpu_particles_3d.cpp:1570.
  // cpu_particles_3d.cpp:1571 — PROPERTY_HINT_NONE, "suffix:m": no range at all, format-only.
  visibility_aabb: v.aabb('visibility_aabb'),
  // cpu_particles_3d.cpp:1572 — plain BOOL, no hint.
  local_coords: v.boolean('local_coords'),
  // cpu_particles_3d.cpp:1573 — PROPERTY_HINT_ENUM "Index,Lifetime,View Depth"; set_draw_order
  // (cpu_particles_3d.cpp:174-177) ERR_FAIL_INDEXes outside 0-2, so the bound is hard here
  // (contrast CPUParticles2D::set_draw_order, which takes any int unconditionally).
  draw_order: v.enumInt('draw_order', 0, 2, DRAW_ORDER),
  // cpu_particles_3d.cpp:1574 — PROPERTY_HINT_RESOURCE_TYPE "Mesh".
  mesh: v.resourceReference('mesh'),

  // ADD_GROUP("Emission Shape", "emission_") — cpu_particles_3d.cpp:1666.
  // cpu_particles_3d.cpp:1667 — PROPERTY_HINT_ENUM, 7 values (Point..Ring).
  emission_shape: v.enumInt('emission_shape', 0, 6, EMISSION_SHAPE),
  // cpu_particles_3d.cpp:1668 — "0.01,128,0.01", no or_greater/or_less: hard both ends.
  emission_sphere_radius: v.float('emission_sphere_radius', { min: 0.01, max: 128 }),
  // cpu_particles_3d.cpp:1669 — VECTOR3, no hint.
  emission_box_extents: v.vector3('emission_box_extents'),
  // cpu_particles_3d.cpp:1670 — PACKED_VECTOR3_ARRAY, no hint.
  emission_points: packedVector3Array('emission_points'),
  // cpu_particles_3d.cpp:1671 — PACKED_VECTOR3_ARRAY, no hint.
  emission_normals: packedVector3Array('emission_normals'),
  // cpu_particles_3d.cpp:1672 — PACKED_COLOR_ARRAY, no hint.
  emission_colors: packedColorArray('emission_colors'),
  // cpu_particles_3d.cpp:1673 — VECTOR3, no hint.
  emission_ring_axis: v.vector3('emission_ring_axis'),
  // cpu_particles_3d.cpp:1674 — "0,1000,0.01,or_greater": or_greater lifts the ceiling; 0 floor hard.
  emission_ring_height: v.nonNegativeFloat('emission_ring_height'),
  // cpu_particles_3d.cpp:1675 — "0,1000,0.01,or_greater": or_greater lifts the ceiling; 0 floor hard.
  emission_ring_radius: v.nonNegativeFloat('emission_ring_radius'),
  // cpu_particles_3d.cpp:1676 — "0,1000,0.01,or_greater": or_greater lifts the ceiling; 0 floor hard.
  emission_ring_inner_radius: v.nonNegativeFloat('emission_ring_inner_radius'),
  // cpu_particles_3d.cpp:1677 — "0,90,0.01,degrees", no or_greater/or_less: hard both ends. The
  // "degrees" token here is a plain unit label (the process code reads the value directly as
  // degrees, see file header), not `radians_as_degrees`, so no v.radians conversion applies.
  emission_ring_cone_angle: v.float('emission_ring_cone_angle', { min: 0, max: 90 }),

  // ADD_GROUP("Particle Flags", "particle_flag_") — cpu_particles_3d.cpp:1678.
  // cpu_particles_3d.cpp:1679-1681 — plain BOOL, no hint, each.
  particle_flag_align_y: v.boolean('particle_flag_align_y'),
  particle_flag_rotate_y: v.boolean('particle_flag_rotate_y'),
  particle_flag_disable_z: v.boolean('particle_flag_disable_z'),

  // ADD_GROUP("Direction", "") — cpu_particles_3d.cpp:1682.
  // cpu_particles_3d.cpp:1683 — VECTOR3, no hint.
  direction: v.vector3('direction'),
  // cpu_particles_3d.cpp:1684 — "0,180,0.01": hard both ends.
  spread: v.float('spread', { min: 0, max: 180 }),
  // cpu_particles_3d.cpp:1685 — "0,1,0.01": hard both ends.
  flatness: v.float('flatness', { min: 0, max: 1 }),

  // ADD_GROUP("Gravity", "") — cpu_particles_3d.cpp:1686.
  // cpu_particles_3d.cpp:1687 — VECTOR3, no hint.
  gravity: v.vector3('gravity'),

  // ADD_GROUP("Initial Velocity", "initial_") — cpu_particles_3d.cpp:1688.
  // cpu_particles_3d.cpp:1689-1690 — "0,1000,0.01,or_greater": or_greater lifts the ceiling; 0 floor hard.
  initial_velocity_min: v.nonNegativeFloat('initial_velocity_min'),
  initial_velocity_max: v.nonNegativeFloat('initial_velocity_max'),

  // ADD_GROUP("Angular Velocity", "angular_") — cpu_particles_3d.cpp:1691.
  // cpu_particles_3d.cpp:1692-1693 — "-720,720,0.01,or_less,or_greater": BOTH sides soft, fully unbounded.
  angular_velocity_min: v.float('angular_velocity_min'),
  angular_velocity_max: v.float('angular_velocity_max'),
  // cpu_particles_3d.cpp:1694 — PROPERTY_HINT_RESOURCE_TYPE "Curve".
  angular_velocity_curve: v.resourceReference('angular_velocity_curve'),

  // ADD_GROUP("Orbit Velocity", "orbit_") — cpu_particles_3d.cpp:1695.
  // cpu_particles_3d.cpp:1696-1697 — "-1000,1000,0.01,or_less,or_greater": both sides soft, unbounded.
  orbit_velocity_min: v.float('orbit_velocity_min'),
  orbit_velocity_max: v.float('orbit_velocity_max'),
  // cpu_particles_3d.cpp:1698 — PROPERTY_HINT_RESOURCE_TYPE "Curve".
  orbit_velocity_curve: v.resourceReference('orbit_velocity_curve'),

  // ADD_GROUP("Linear Accel", "linear_") — cpu_particles_3d.cpp:1699.
  // cpu_particles_3d.cpp:1700-1701 — "-100,100,0.01,or_less,or_greater": both sides soft, unbounded.
  linear_accel_min: v.float('linear_accel_min'),
  linear_accel_max: v.float('linear_accel_max'),
  // cpu_particles_3d.cpp:1702 — PROPERTY_HINT_RESOURCE_TYPE "Curve".
  linear_accel_curve: v.resourceReference('linear_accel_curve'),

  // ADD_GROUP("Radial Accel", "radial_") — cpu_particles_3d.cpp:1703.
  // cpu_particles_3d.cpp:1704-1705 — "-100,100,0.01,or_less,or_greater": both sides soft, unbounded.
  radial_accel_min: v.float('radial_accel_min'),
  radial_accel_max: v.float('radial_accel_max'),
  // cpu_particles_3d.cpp:1706 — PROPERTY_HINT_RESOURCE_TYPE "Curve".
  radial_accel_curve: v.resourceReference('radial_accel_curve'),

  // ADD_GROUP("Tangential Accel", "tangential_") — cpu_particles_3d.cpp:1707.
  // cpu_particles_3d.cpp:1708-1709 — "-100,100,0.01,or_less,or_greater": both sides soft, unbounded.
  tangential_accel_min: v.float('tangential_accel_min'),
  tangential_accel_max: v.float('tangential_accel_max'),
  // cpu_particles_3d.cpp:1710 — PROPERTY_HINT_RESOURCE_TYPE "Curve".
  tangential_accel_curve: v.resourceReference('tangential_accel_curve'),

  // ADD_GROUP("Damping", "") — cpu_particles_3d.cpp:1711.
  // cpu_particles_3d.cpp:1712-1713 — "0,100,0.001,or_greater": or_greater lifts the ceiling; 0 floor hard.
  damping_min: v.nonNegativeFloat('damping_min'),
  damping_max: v.nonNegativeFloat('damping_max'),
  // cpu_particles_3d.cpp:1714 — PROPERTY_HINT_RESOURCE_TYPE "Curve".
  damping_curve: v.resourceReference('damping_curve'),

  // ADD_GROUP("Angle", "") — cpu_particles_3d.cpp:1715.
  // cpu_particles_3d.cpp:1716-1717 — "-720,720,0.1,or_less,or_greater,degrees": both sides soft, unbounded.
  angle_min: v.float('angle_min'),
  angle_max: v.float('angle_max'),
  // cpu_particles_3d.cpp:1718 — PROPERTY_HINT_RESOURCE_TYPE "Curve".
  angle_curve: v.resourceReference('angle_curve'),

  // ADD_GROUP("Scale", "") — cpu_particles_3d.cpp:1719.
  // cpu_particles_3d.cpp:1720-1721 — "0,1000,0.01,or_greater": or_greater lifts the ceiling; 0 floor hard.
  scale_amount_min: v.nonNegativeFloat('scale_amount_min'),
  scale_amount_max: v.nonNegativeFloat('scale_amount_max'),
  // cpu_particles_3d.cpp:1722 — PROPERTY_HINT_RESOURCE_TYPE "Curve".
  scale_amount_curve: v.resourceReference('scale_amount_curve'),
  // cpu_particles_3d.cpp:1723 — plain BOOL, no hint.
  split_scale: v.boolean('split_scale'),
  // cpu_particles_3d.cpp:1724-1726 — PROPERTY_HINT_RESOURCE_TYPE "Curve", each.
  scale_curve_x: v.resourceReference('scale_curve_x'),
  scale_curve_y: v.resourceReference('scale_curve_y'),
  scale_curve_z: v.resourceReference('scale_curve_z'),

  // ADD_GROUP("Color", "") — cpu_particles_3d.cpp:1727.
  // cpu_particles_3d.cpp:1728 — COLOR, no hint.
  color: v.color('color'),
  // cpu_particles_3d.cpp:1729-1730 — PROPERTY_HINT_RESOURCE_TYPE "Gradient", each.
  color_ramp: v.resourceReference('color_ramp'),
  color_initial_ramp: v.resourceReference('color_initial_ramp'),

  // ADD_GROUP("Hue Variation", "hue_") — cpu_particles_3d.cpp:1732.
  // cpu_particles_3d.cpp:1733-1734 — "-1,1,0.01", no or_greater/or_less: hard both ends.
  hue_variation_min: v.float('hue_variation_min', { min: -1, max: 1 }),
  hue_variation_max: v.float('hue_variation_max', { min: -1, max: 1 }),
  // cpu_particles_3d.cpp:1735 — PROPERTY_HINT_RESOURCE_TYPE "Curve".
  hue_variation_curve: v.resourceReference('hue_variation_curve'),

  // ADD_GROUP("Animation", "anim_") — cpu_particles_3d.cpp:1736.
  // cpu_particles_3d.cpp:1737-1738 — "0,128,0.01,or_greater,or_less": BOTH sides soft, fully unbounded.
  anim_speed_min: v.float('anim_speed_min'),
  anim_speed_max: v.float('anim_speed_max'),
  // cpu_particles_3d.cpp:1739 — PROPERTY_HINT_RESOURCE_TYPE "Curve".
  anim_speed_curve: v.resourceReference('anim_speed_curve'),
  // cpu_particles_3d.cpp:1740-1741 — "0,1,0.0001", no or_greater/or_less: hard both ends.
  anim_offset_min: v.float('anim_offset_min', { min: 0, max: 1 }),
  anim_offset_max: v.float('anim_offset_max', { min: 0, max: 1 }),
  // cpu_particles_3d.cpp:1742 — PROPERTY_HINT_RESOURCE_TYPE "Curve".
  anim_offset_curve: v.resourceReference('anim_offset_curve'),
});
