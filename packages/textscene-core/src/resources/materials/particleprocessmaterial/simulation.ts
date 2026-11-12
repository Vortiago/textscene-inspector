/**
 * What the GPU simulation reads of a ParticleProcessMaterial beside its emission: the start
 * velocity, the accelerations, the scale and the colour. The defaults are the material
 * constructor's (`particle_process_material.cpp:2374-2427`), not the CPUParticles3D ones.
 */

import type { Rgba } from '../../../godot/math/math.js';
import { storedReal } from '../../../godot/math/real';
import type { Vector3 } from '../../../godot/math/vector';
import { realOr, realVec3Or } from '../../../parser/valueParsers';
import { sRGBChannelToLinear } from '../../../utils/colorSpace';
import { colorOr } from '../../../utils/colorParser';

/** A parameter's `_min` and `_max`, between which each particle draws its value. */
export interface ParamRange {
  min: number;
  max: number;
}

export interface ProcessSimulation {
  direction: Vector3;
  /** In degrees. */
  spread: number;
  flatness: number;
  initialVelocity: ParamRange;
  linearAccel: ParamRange;
  radialAccel: ParamRange;
  tangentialAccel: ParamRange;
  scale: ParamRange;
  gravity: Vector3;
  lifetimeRandomness: number;
  /** In linear light: the shader declares `color_value : source_color` (`particle_process_material.cpp:309`). Alpha is as authored. */
  color: Rgba;
}

const WHITE: Rgba = { r: 1, g: 1, b: 1, a: 1 };

function rangeOr(properties: Record<string, string>, stem: string, fallback: ParamRange): ParamRange {
  return {
    min: realOr(properties[`${stem}_min`], fallback.min, `${stem}_min`),
    max: realOr(properties[`${stem}_max`], fallback.max, `${stem}_max`),
  };
}

const ZERO_RANGE: ParamRange = { min: 0, max: 0 };

export function decodeProcessSimulation(properties: Record<string, string>): ProcessSimulation {
  const authored = colorOr(properties.color, WHITE);
  return {
    direction: realVec3Or(properties.direction, { x: 1, y: 0, z: 0 }, 'direction'),
    spread: realOr(properties.spread, 45, 'spread'),
    flatness: realOr(properties.flatness, 0, 'flatness'),
    initialVelocity: rangeOr(properties, 'initial_velocity', ZERO_RANGE),
    linearAccel: rangeOr(properties, 'linear_accel', ZERO_RANGE),
    radialAccel: rangeOr(properties, 'radial_accel', ZERO_RANGE),
    tangentialAccel: rangeOr(properties, 'tangential_accel', ZERO_RANGE),
    scale: rangeOr(properties, 'scale', { min: 1, max: 1 }),
    gravity: realVec3Or(properties.gravity, { x: 0, y: -9.8, z: 0 }, 'gravity'),
    lifetimeRandomness: realOr(properties.lifetime_randomness, 0, 'lifetime_randomness'),
    color: {
      r: storedReal(sRGBChannelToLinear(storedReal(authored.r))),
      g: storedReal(sRGBChannelToLinear(storedReal(authored.g))),
      b: storedReal(sRGBChannelToLinear(storedReal(authored.b))),
      a: storedReal(authored.a),
    },
  };
}
