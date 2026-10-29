/** The CPUParticles3D tests' shared emitters, and the simulation input and buffer they read. */

import type { TscnInternalResource, TscnNode } from '../../../../parser/types';
import { heading, makeNode } from '../../../../parser/testing/parserKit';
import { identityTransform3D } from '../../../../godot/math/transform3d';
import type { Vector3 } from '../../../../godot/math/vector';
import { CPU_PARTICLES_PARAM_COUNT } from '../../../shared/cpuparticles/params';
import { parseCPUParticles3D } from './parser';
import './index';
import {
  particleRows,
  particlesInDrawOrder,
  type ParticleSim3DInput,
  type SettledParticles,
} from './simulate';

/** The mesh `ROW_OF_FOUR` draws. */
export const BOX: TscnInternalResource = {
  id: 'Box',
  type: 'BoxMesh',
  data: { size: 'Vector3(0.2, 0.2, 0.2)' },
};

/**
 * The issue's measured emitter, as `unit-cpuparticles3d-row.tscn` writes it: four particles, one
 * born each half second at 1 unit a second along +x, in a row at x = 0, 0.5, 1 and 1.5.
 */
export const ROW_OF_FOUR: Readonly<Record<string, string>> = {
  amount: '4',
  lifetime: '2.0',
  preprocess: '1.5',
  use_fixed_seed: 'true',
  seed: '7',
  direction: 'Vector3(1, 0, 0)',
  spread: '0.0',
  gravity: 'Vector3(0, 0, 0)',
  initial_velocity_min: '1.0',
  initial_velocity_max: '1.0',
  color: 'Color(1, 0.5, 0, 1)',
  mesh: 'SubResource("Box")',
};

/** An emitter node named `name`, parsed from `properties`. */
export function emitterNode(properties: Record<string, string>, name = 'Row'): TscnNode {
  return makeNode(name, 'CPUParticles3D', { rawProperties: properties });
}

/** The simulation input of an emitter with no curve, no ramp and an identity transform. */
export function simInput(
  properties: Record<string, string>,
  overrides: Partial<ParticleSim3DInput> = {}
): ParticleSim3DInput {
  const { simulation, emission } = parseCPUParticles3D(heading('CPUParticles3D', { name: 'P' }), properties);
  return {
    sim: simulation,
    emission,
    curves: Array.from({ length: CPU_PARTICLES_PARAM_COUNT }, () => null),
    scaleCurves: { x: null, y: null, z: null },
    colorRamp: null,
    colorInitialRamp: null,
    emissionTransform: identityTransform3D(),
    ...overrides,
  };
}

/** The buffer the multimesh draws, in draw order along `viewAxis`. */
export function drawnBuffer(settled: SettledParticles, viewAxis: Vector3 | null = null): Float32Array {
  return particlesInDrawOrder(settled, particleRows(settled), viewAxis);
}
