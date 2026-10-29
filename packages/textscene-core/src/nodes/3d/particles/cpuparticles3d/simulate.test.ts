/**
 * The CPUParticles3D frozen pose against Godot 4.6.3's own `particle_data`. Each expected buffer is
 * what `RenderingServer.multimesh_get_buffer` returned for the emitter after its enter-tree settle,
 * read by /mnt/project-files/cpuparticles3d-633/oracle.gd with the properties each case names.
 */

import { describe, expect, it } from 'vitest';
import { PARTICLE_FLOATS } from './particleBuffer';
import { settleParticles } from './simulate';
import { drawnBuffer, ROW_OF_FOUR, simInput as input } from './cpuparticles3d.testkit';
import {
  identityTransform3D,
  multiplyTransform3D,
  type Transform3D,
} from '../../../../godot/math/transform3d';
import { parseTransform3D } from '../../../../utils/transform';
import { ORACLE_CASES, type OracleCase } from './simulateOracle.testkit';
import type { Curve } from '../../../../resources/curves/curve/types';
import { curveOf, point } from '../../../../resources/curves/curve/curve.testkit';
import type { Gradient } from '../../../../resources/textures/gradienttexture2d/types';
import { GradientInterpolationMode } from '../../../../godot/scene/gradientTexture';
import { PARAM_SLOTS } from '../../../shared/cpuparticles/params';
import { storedColor, storedReal } from '../../../../godot/math/real';

/** A `Curve` as `Curve.add_point(position, left, right)` builds it, in the `real_t` the decoder stores. */
function curveFrom(points: number[][]): Curve {
  return curveOf(
    ...points.map(([x, y, left, right]) =>
      point(storedReal(x!), storedReal(y!), storedReal(left!), storedReal(right!))
    )
  );
}

/** A linear `Gradient` with the oracle's stops, in the floats the decoder stores. */
function gradientOf(stops: number[][] | undefined): Gradient | null {
  if (!stops) return null;
  return {
    stops: stops.map(([offset, r, g, b, a]) => ({
      offset: storedReal(offset!),
      color: storedColor({ r: r!, g: g!, b: b!, a: a! }),
    })),
    interpolationMode: GradientInterpolationMode.LINEAR,
  };
}

function curveNamed(curves: OracleCase['curves'], name: string): Curve | null {
  const points = curves?.[name];
  return points ? curveFrom(points) : null;
}

/** The global `basis.get_column(2)` of a camera beside the emitter, the axis VIEW_DEPTH sorts along. */
function cameraAxis(parent: Transform3D, camera: string) {
  const { basis_x, basis_y, basis_z } = multiplyTransform3D(parent, parseTransform3D(camera));
  return { x: basis_x.z, y: basis_y.z, z: basis_z.z };
}

/** The buffer the oracle's emitter writes. Its emitter and camera are both children of `parent`. */
function oracleBuffer({ properties, parent, camera, curves, ramps }: OracleCase): Float32Array {
  const emissionTransform = parent ? parseTransform3D(parent) : identityTransform3D();
  const settled = settleParticles(
    input(properties, {
      curves: PARAM_SLOTS.map(({ prefix }) => curveNamed(curves, `${prefix}_curve`)),
      scaleCurves: {
        x: curveNamed(curves, 'scale_curve_x'),
        y: curveNamed(curves, 'scale_curve_y'),
        z: curveNamed(curves, 'scale_curve_z'),
      },
      colorRamp: gradientOf(ramps?.color_ramp),
      colorInitialRamp: gradientOf(ramps?.color_initial_ramp),
      emissionTransform,
    })
  );
  return drawnBuffer(settled, camera ? cameraAxis(emissionTransform, camera) : null);
}

/** The buffer as one array of 20 floats per particle, in draw order. */
function rows(buffer: Float32Array): number[][] {
  const out: number[][] = [];
  for (let at = 0; at < buffer.length; at += PARTICLE_FLOATS)
    out.push(Array.from(buffer.subarray(at, at + PARTICLE_FLOATS)));
  return out;
}

describe('the drawn buffer after settleParticles', () => {
  it('writes the buffer Godot writes for a point emitter (happy path)', () => {
    expect(rows(drawnBuffer(settleParticles(input(ROW_OF_FOUR)), null))).toEqual([
      [1, 0, 0, 1.4999998807907104, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0.5, 0, 1, 0, 0.7333333492279053, 0, 1],
      [1, 0, 0, 1.0000003576278687, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0.5, 0, 1, 0, 0.4833333194255829, 0, 1],
      [1, 0, 0, 0.5, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0.5, 0, 1, 0, 0.23333333432674408, 0, 1],
      [1, 0, 0, 1.3322676295501878e-15, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0.5, 0, 1, 0, 0, 0, 1],
    ]);
  });

  it.each(Object.entries(ORACLE_CASES))('writes the buffer Godot writes for the %s case', (_, oracle) => {
    expect(rows(oracleBuffer(oracle))).toEqual(rows(new Float32Array(oracle.buffer)));
  });
});

describe('the POINTS shape with more than one point', () => {
  // Godot picks each point from its unsaved process-wide RNG, so only the set of places is fixed.
  const POINTS = { x: [0.5, -1, 2], y: [-0.25, 0.75, 0], z: [1, 0, -2] };
  const properties = {
    amount: '12',
    lifetime: '1.0',
    initial_velocity_min: '0.0',
    initial_velocity_max: '0.0',
    gravity: 'Vector3(0, 0, 0)',
    emission_shape: '4',
    emission_points: 'PackedVector3Array(0.5, -0.25, 1, -1, 0.75, 0, 2, 0, -2)',
    emission_colors: 'PackedColorArray(1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1)',
  };

  it('places every particle on one of the points, with that point colour', () => {
    for (const row of rows(drawnBuffer(settleParticles(input(properties)), null))) {
      const index = POINTS.x.findIndex(
        (x, i) => x === row[3] && POINTS.y[i] === row[7] && POINTS.z[i] === row[11]
      );
      expect(index).toBeGreaterThanOrEqual(0);
      expect(row[12 + index]).toBeGreaterThan(0.9);
    }
  });

  it('uses every point', () => {
    const origins = new Set(rows(drawnBuffer(settleParticles(input(properties)), null)).map((row) => row[3]));
    expect(origins).toEqual(new Set(POINTS.x));
  });
});
