/** The render parse of a CPUParticles3D: its instance state, what its box reads, its emission and its simulation. */

import type { ParsedHeading } from '../../../../parser/utils';
import { holdsResource } from '../../../../godot/scene/resourceLiteral';
import {
  boolOr,
  enumOr,
  floatOr,
  intOr,
  parseNonEmptyAabb,
  realOr,
  realVec3Or,
  settableFloatOr,
} from '../../../../parser/valueParsers';
import { colorOr } from '../../../../utils/colorParser';
import { storedColor } from '../../../../godot/math/real';
import { CPUParticles3DDrawOrder } from '../../../../godot/scene/particles3d';
import { parsePackedColorArray, parsePackedVector3Array } from '../../../../resources/shapes/packedArray';
import { readParticleEmission } from '../../../../resources/materials/particleprocessmaterial/emission';
import { parseParticleAmount, parseParticleParams } from '../../../shared/cpuparticles/params';
import { parseGeometryInstance3D } from '../../geometryinstance3d/parser';
import { warn } from '../../../../logger';
import type { CPUParticles3DProperties, CPUParticles3DSimulation } from './types';

const DRAW_ORDERS = Object.values(CPUParticles3DDrawOrder);

export function parseCPUParticles3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): CPUParticles3DProperties {
  const mesh = heldReference(properties.mesh);
  return {
    ...parseGeometryInstance3D(heading, properties),
    visibilityAabb: parseNonEmptyAabb(properties.visibility_aabb, 'visibility_aabb'),
    mesh,
    hasMesh: mesh !== undefined,
    materialOverride: heldReference(properties.material_override),
    materialOverlay: heldReference(properties.material_overlay),
    emission: readParticleEmission(properties),
    simulation: parseSimulation(properties, heading.attributes.name ?? 'CPUParticles3D'),
  };
}

function parseSimulation(properties: Record<string, string>, context: string): CPUParticles3DSimulation {
  const at = (key: string) => `${context}.${key}`;
  return {
    emitting: boolOr(properties.emitting, true, at('emitting')),
    amount: parseParticleAmount(properties.amount, at('amount')),
    // `set_lifetime` refuses a lifetime that is not above zero (`cpu_particles_3d.cpp:92`).
    lifetime: settableFloatOr(properties.lifetime, 1, { min: Number.MIN_VALUE }, at('lifetime')),
    oneShot: boolOr(properties.one_shot, false, at('one_shot')),
    preprocess: floatOr(properties.preprocess, 0, at('preprocess')),
    explosiveness: realOr(properties.explosiveness, 0, at('explosiveness')),
    randomness: realOr(properties.randomness, 0, at('randomness')),
    useFixedSeed: boolOr(properties.use_fixed_seed, false, at('use_fixed_seed')),
    // `set_seed` takes a `uint32_t`, so 4294967295 is the seed the file states, not -1.
    seed: intOr(properties.seed, 0, at('seed'), 'uint32'),
    lifetimeRandomness: floatOr(properties.lifetime_randomness, 0, at('lifetime_randomness')),
    fixedFps: intOr(properties.fixed_fps, 0, at('fixed_fps')),
    speedScale: floatOr(properties.speed_scale, 1, at('speed_scale')),
    fractDelta: boolOr(properties.fract_delta, true, at('fract_delta')),
    localCoords: boolOr(properties.local_coords, false, at('local_coords')),
    drawOrder: enumOr(properties.draw_order, CPUParticles3DDrawOrder.INDEX, DRAW_ORDERS, at('draw_order')),
    emissionPoints: packedOrEmpty(parsePackedVector3Array, properties.emission_points, at('emission_points')),
    emissionNormals: packedOrEmpty(
      parsePackedVector3Array,
      properties.emission_normals,
      at('emission_normals')
    ),
    emissionColors: packedOrEmpty(parsePackedColorArray, properties.emission_colors, at('emission_colors')),
    alignY: boolOr(properties.particle_flag_align_y, false, at('particle_flag_align_y')),
    rotateY: boolOr(properties.particle_flag_rotate_y, false, at('particle_flag_rotate_y')),
    disableZ: boolOr(properties.particle_flag_disable_z, false, at('particle_flag_disable_z')),
    direction: realVec3Or(properties.direction, { x: 1, y: 0, z: 0 }, at('direction')),
    spread: realOr(properties.spread, 45, at('spread')),
    flatness: realOr(properties.flatness, 0, at('flatness')),
    gravity: realVec3Or(properties.gravity, { x: 0, y: -9.8, z: 0 }, at('gravity')),
    params: parseParticleParams(properties),
    splitScale: boolOr(properties.split_scale, false, at('split_scale')),
    scaleCurves: {
      x: heldReference(properties.scale_curve_x),
      y: heldReference(properties.scale_curve_y),
      z: heldReference(properties.scale_curve_z),
    },
    color: storedColor(colorOr(properties.color, { r: 1, g: 1, b: 1, a: 1 })),
    colorRamp: heldReference(properties.color_ramp),
    colorInitialRamp: heldReference(properties.color_initial_ramp),
  };
}

function heldReference(value: string | undefined): string | undefined {
  return holdsResource(value) ? value : undefined;
}

/** A packed slot's floats, or none for an absent value and one this cannot read. */
function packedOrEmpty(
  parse: (value: string) => Float32Array,
  value: string | undefined,
  context: string
): Float32Array {
  if (value === undefined) return EMPTY;
  try {
    return parse(value);
  } catch (error) {
    warn(`${context}: ${error instanceof Error ? error.message : String(error)}, keeping none`);
    return EMPTY;
  }
}

const EMPTY = new Float32Array(0);
