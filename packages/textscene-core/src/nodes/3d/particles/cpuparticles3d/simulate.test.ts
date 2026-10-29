/**
 * The CPUParticles3D frozen pose against Godot 4.6.3's own `particle_data`. Each expected buffer is
 * what `RenderingServer.multimesh_get_buffer` returned for the emitter after its enter-tree settle,
 * read by /mnt/project-files/cpuparticles3d-633/oracle.gd with the properties each case names.
 */

import { describe, expect, it } from 'vitest';
import { PARTICLE_FLOATS, settleParticles } from './simulate';
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

/**
 * How many float steps of the larger magnitude, floored at 0.5, lie between `a` and `b`. An align_y
 * frame drifts from Godot's by one step once a second step changes the velocity. Its align and
 * orthonormalise steps match GDScript's bit for bit, and the cause of the drift is not found.
 */
function floatStepsApart(a: number, b: number): number {
  const step = 2 ** -23 * Math.max(Math.abs(a), Math.abs(b), 0.5);
  return Math.abs(a - b) / step;
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
    const buffer = oracleBuffer(oracle);
    const expected = new Float32Array(oracle.buffer);
    if (oracle.floatSteps === undefined) {
      expect(rows(buffer)).toEqual(rows(expected));
      return;
    }
    expect(buffer.length).toBe(expected.length);
    buffer.forEach((value, at) =>
      expect(floatStepsApart(value, expected[at]!)).toBeLessThanOrEqual(oracle.floatSteps!)
    );
  });
});
