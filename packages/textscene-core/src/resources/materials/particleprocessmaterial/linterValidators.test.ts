/**
 * ParticleProcessMaterial validators, on the `[sub_resource]` itself. Each family states its
 * properties as the hint string in `particle_process_material.cpp` spells them. Every property
 * gets a value it accepts, a value it refuses or warns on, and an edge.
 */

import { describe, it } from 'vitest';
import {
  expectDiagnostic,
  expectNoDiagnostic,
  node,
  scene,
  subResource,
} from '../../../linter/testing/testkit';
import './linterValidators';

function sceneWith(property: string, value: string): string {
  return scene(subResource('ParticleProcessMaterial', { [property]: value }), node('Node3D'));
}

/** A hint's range ends: `null` leaves that end open (`or_less`, `or_greater`). */
type HintEnds = readonly [lowest: number | null, highest: number | null];

/**
 * The `_min` and `_max` property that `ADD_MIN_MAX_PROPERTY` registers for one stem
 * (`particle_process_material.cpp:2202-2205`), both under the stem's range string.
 */
function minMax(stem: string, ends: HintEnds): [string, HintEnds][] {
  return [
    [`${stem}_min`, ends],
    [`${stem}_max`, ends],
  ];
}

/** `PROPERTY_HINT_RANGE` ends of the FLOAT properties (`particle_process_material.cpp:2207-2313`). */
const FLOAT_RANGES: [string, HintEnds][] = [
  ['lifetime_randomness', [0, 1]],
  ['emission_sphere_radius', [0.01, null]],
  ['emission_ring_height', [0, null]],
  ['emission_ring_radius', [0, null]],
  ['emission_ring_inner_radius', [0, null]],
  ['emission_ring_cone_angle', [0, 90]],
  ['inherit_velocity_ratio', [null, null]],
  ['spread', [0, 180]],
  ['flatness', [0, 1]],
  ['turbulence_noise_strength', [0, 20]],
  ['turbulence_noise_scale', [0, null]],
  ['turbulence_noise_speed_random', [0, 4]],
  ['collision_friction', [0, 1]],
  ['collision_bounce', [0, 1]],
  ['sub_emitter_frequency', [0.01, 100]],
  ...minMax('angle', [null, null]),
  ...minMax('initial_velocity', [null, null]),
  ...minMax('angular_velocity', [null, null]),
  ...minMax('directional_velocity', [null, null]),
  ...minMax('orbit_velocity', [null, null]),
  ...minMax('radial_velocity', [null, null]),
  ...minMax('linear_accel', [null, null]),
  ...minMax('radial_accel', [null, null]),
  ...minMax('tangential_accel', [null, null]),
  ...minMax('damping', [0, null]),
  ...minMax('scale', [0, null]),
  ...minMax('scale_over_velocity', [0, null]),
  ...minMax('hue_variation', [-1, 1]),
  ...minMax('anim_speed', [null, null]),
  ...minMax('anim_offset', [0, 1]),
  ...minMax('turbulence_influence', [0, 1]),
  ...minMax('turbulence_initial_displacement', [-100, 100]),
];

/** `PROPERTY_HINT_RANGE` ends of the INT properties (`particle_process_material.cpp:2223, 2314-2316`). */
const INT_RANGES: [string, HintEnds][] = [
  ['emission_point_count', [0, 1000000]],
  ['sub_emitter_amount_at_end', [1, 32]],
  ['sub_emitter_amount_at_collision', [1, 32]],
  ['sub_emitter_amount_at_start', [1, 32]],
];

const RANGES = [...FLOAT_RANGES, ...INT_RANGES];

/** A value between the ends, for an end left open a step from the other. */
function insideOf([lowest, highest]: HintEnds): number {
  if (lowest !== null && highest !== null) return Math.round((lowest + highest) / 2);
  return lowest === null ? 0 : lowest + 1;
}

/** The ends that the hint closes, each with the nearest whole number past it. */
function closedEnds([lowest, highest]: HintEnds): { end: number; past: number }[] {
  return [
    ...(lowest === null ? [] : [{ end: lowest, past: Math.floor(lowest) - 1 }]),
    ...(highest === null ? [] : [{ end: highest, past: Math.ceil(highest) + 1 }]),
  ];
}

describe('ranged ParticleProcessMaterial properties', () => {
  it.each(RANGES)('%s accepts a value inside its hint', (property, ends) => {
    expectNoDiagnostic(sceneWith(property, String(insideOf(ends))), { prop: property });
  });

  it.each(RANGES.flatMap(([property, ends]) => closedEnds(ends).map((end) => [property, end] as const)))(
    '%s accepts the end of its hint and warns past it',
    (property, { end, past }) => {
      expectNoDiagnostic(sceneWith(property, String(end)), { prop: property });
      expectDiagnostic(sceneWith(property, String(past)), { prop: property, severity: 'warning' });
    }
  );

  it.each(RANGES)('%s accepts a value far past an open end of its hint', (property, [lowest, highest]) => {
    if (lowest === null) expectNoDiagnostic(sceneWith(property, '-1000000'), { prop: property });
    if (highest === null) expectNoDiagnostic(sceneWith(property, '1000000'), { prop: property });
  });

  it.each(RANGES)('%s errors on a value that is no number', (property) => {
    expectDiagnostic(sceneWith(property, '"fast"'), { prop: property, severity: 'error' });
  });
});

/** The enums, as `[property, highest member, first value past it, severity of that value]`. */
const ENUM_MEMBERS: [string, number, number, 'error' | 'warning'][] = [
  // `set_emission_shape` refuses an index past `EMISSION_SHAPE_MAX` (`particle_process_material.cpp:1630`).
  ['emission_shape', 6, 7, 'error'],
  // `set_collision_mode` and `set_sub_emitter_mode` assign bare (`:2016`, `:1950`).
  ['collision_mode', 2, 3, 'warning'],
  ['sub_emitter_mode', 4, 5, 'warning'],
];

describe('enum ParticleProcessMaterial properties', () => {
  it.each(ENUM_MEMBERS)('%s accepts its first member', (property) => {
    expectNoDiagnostic(sceneWith(property, '0'), { prop: property });
  });

  it.each(ENUM_MEMBERS)(
    '%s accepts its last member and flags the next value',
    (property, last, past, severity) => {
      expectNoDiagnostic(sceneWith(property, String(last)), { prop: property });
      expectDiagnostic(sceneWith(property, String(past)), { prop: property, severity });
    }
  );

  it.each(ENUM_MEMBERS)('%s flags a negative value', (property, _last, _past, severity) => {
    expectDiagnostic(sceneWith(property, '-1'), { prop: property, severity });
  });

  it('keeps the sub-emitter mode at At Start, which the hint lists out of order (`:2312`)', () => {
    expectNoDiagnostic(sceneWith('sub_emitter_mode', '4'), { prop: 'sub_emitter_mode' });
  });
});

const BOOLEANS = [
  'attractor_interaction_enabled',
  'collision_use_scale',
  'particle_flag_align_y',
  'particle_flag_rotate_y',
  'particle_flag_disable_z',
  'particle_flag_damping_as_friction',
  'sub_emitter_keep_velocity',
  'turbulence_enabled',
];

describe('boolean ParticleProcessMaterial properties', () => {
  it.each(BOOLEANS)('%s accepts true', (property) => {
    expectNoDiagnostic(sceneWith(property, 'true'), { prop: property });
  });

  it.each(BOOLEANS)('%s errors on a word that is no boolean', (property) => {
    expectDiagnostic(sceneWith(property, '"yes"'), { prop: property, severity: 'error' });
  });

  it.each(BOOLEANS)('%s warns on a 1 that the slot stores as true (edge)', (property) => {
    expectDiagnostic(sceneWith(property, '1'), { prop: property, severity: 'warning' });
  });
});

const VECTORS = [
  'emission_shape_offset',
  'emission_shape_scale',
  'emission_box_extents',
  'emission_ring_axis',
  'direction',
  'velocity_pivot',
  'gravity',
  'turbulence_noise_speed',
];

describe('Vector3 ParticleProcessMaterial properties', () => {
  it.each(VECTORS)('%s accepts a Vector3', (property) => {
    expectNoDiagnostic(sceneWith(property, 'Vector3(1, 2, 3)'), { prop: property });
  });

  it.each(VECTORS)('%s errors on a Vector3 with two components', (property) => {
    expectDiagnostic(sceneWith(property, 'Vector3(1, 2)'), { prop: property, severity: 'error' });
  });

  it.each(VECTORS)(
    '%s accepts the zero and the negative vector, which the setter assigns bare (edge)',
    (property) => {
      expectNoDiagnostic(sceneWith(property, 'Vector3(0, 0, 0)'), { prop: property });
      expectNoDiagnostic(sceneWith(property, 'Vector3(-4, -0.5, -1e3)'), { prop: property });
    }
  );
});

describe('color', () => {
  it('accepts a Color', () => {
    expectNoDiagnostic(sceneWith('color', 'Color(1, 0.5, 0, 1)'), { prop: 'color' });
  });

  it('errors on a Color with two components', () => {
    expectDiagnostic(sceneWith('color', 'Color(1, 1)'), { prop: 'color', severity: 'error' });
  });

  it('accepts a component past 1, which the setter assigns bare (edge)', () => {
    expectNoDiagnostic(sceneWith('color', 'Color(4, -1, 0, 0)'), { prop: 'color' });
  });
});

const RESOURCE_SLOTS = [
  'alpha_curve',
  'angle_curve',
  'angular_velocity_curve',
  'anim_offset_curve',
  'anim_speed_curve',
  'color_initial_ramp',
  'color_ramp',
  'damping_curve',
  'directional_velocity_curve',
  'emission_color_texture',
  'emission_curve',
  'emission_normal_texture',
  'emission_point_texture',
  'hue_variation_curve',
  'linear_accel_curve',
  'orbit_velocity_curve',
  'radial_accel_curve',
  'radial_velocity_curve',
  'scale_curve',
  'scale_over_velocity_curve',
  'tangential_accel_curve',
  'turbulence_influence_over_life',
  'velocity_limit_curve',
];

describe('resource-slot ParticleProcessMaterial properties', () => {
  it.each(RESOURCE_SLOTS)('%s accepts a sub-resource reference', (property) => {
    const declared = scene(
      subResource('CurveTexture', {}, 'Curve_1'),
      subResource('ParticleProcessMaterial', { [property]: 'SubResource("Curve_1")' }),
      node('Node3D')
    );
    expectNoDiagnostic(declared, { prop: property });
  });

  it.each(RESOURCE_SLOTS)('%s errors on a number', (property) => {
    expectDiagnostic(sceneWith(property, '3.5'), { prop: property, severity: 'error' });
  });

  it.each(RESOURCE_SLOTS)('%s accepts null, which clears the slot (edge)', (property) => {
    expectNoDiagnostic(sceneWith(property, 'null'), { prop: property });
  });
});

describe('a ParticleProcessMaterial held in a .tres', () => {
  it('warns on a spread past its hint', () => {
    expectDiagnostic(
      '[gd_resource type="ParticleProcessMaterial" format=3]\n\n[resource]\nspread = 300.0\n',
      {
        prop: 'spread',
        severity: 'warning',
      }
    );
  });
});
