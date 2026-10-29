import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { EMPTY_AABB, type Aabb } from '../../../../godot/math/aabb';
import { parseNonEmptyAabb } from '../../../../parser/valueParsers';
import { identityTransform3D } from '../../../../godot/math/transform3d';
import { parseCPUParticles3D } from './parser';
import { particlesAabb } from './ownAabb';
import { particleDataBuffer, settleParticles } from './simulate';
import { ORACLE_CASES } from './simulateOracle.testkit';

/** The oracle's mesh: a 0.2 BoxMesh, centred. */
const ORACLE_MESH_AABB: Aabb = { position: { x: -0.1, y: -0.1, z: -0.1 }, size: { x: 0.2, y: 0.2, z: 0.2 } };

function emitter(properties: Record<string, string>) {
  return parseCPUParticles3D(heading('CPUParticles3D', { name: 'Sparks' }), properties);
}

/** The box the emitter's own settled pose gives, under the oracle's mesh. */
function settledAabb(properties: Record<string, string>): Aabb | null {
  const props = emitter({ ...properties, mesh: 'SubResource("Box")' });
  const settled = settleParticles({
    props,
    curves: Array.from({ length: 12 }, () => null),
    scaleCurves: { x: null, y: null, z: null },
    colorRamp: null,
    colorInitialRamp: null,
    emissionTransform: identityTransform3D(),
  });
  return particlesAabb(props, particleDataBuffer(settled, null), ORACLE_MESH_AABB);
}

function expectNearAabb(actual: Aabb | null, expected: Aabb | null): void {
  for (const corner of ['position', 'size'] as const) {
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(actual![corner][axis]).toBeCloseTo(expected![corner][axis], 5);
    }
  }
}

describe('particlesAabb', () => {
  it('merges the mesh box over every live particle, as capture_aabb measures (happy path)', () => {
    const { properties, aabb } = ORACLE_CASES.box!;
    expectNearAabb(settledAabb(properties), parseNonEmptyAabb(aabb, 'oracle'));
  });

  it('reaches the emitter origin for a never-born particle (edge case)', () => {
    // Two of the three particles are born half a lifetime in, so the third holds a zero transform.
    const { properties, aabb } = ORACLE_CASES.sphere!;
    const box = settledAabb(properties);
    expectNearAabb(box, parseNonEmptyAabb(aabb, 'oracle'));
    expect(box!.position.x).toBe(0);
  });

  it('takes the authored visibility_aabb', () => {
    const props = emitter({ mesh: 'SubResource("Box")', visibility_aabb: 'AABB(-1, -1, -1, 2, 2, 2)' });
    expect(particlesAabb(props, new Float32Array(0), ORACLE_MESH_AABB)?.size).toEqual({ x: 2, y: 2, z: 2 });
  });

  it('waits on a mesh box that is not known yet (error case)', () => {
    expect(particlesAabb(emitter({ mesh: 'SubResource("Box")' }), new Float32Array(20), null)).toBeNull();
  });

  it('gives an emitter with no mesh the empty box (edge case)', () => {
    expect(particlesAabb(emitter({}), new Float32Array(20), ORACLE_MESH_AABB)).toBe(EMPTY_AABB);
  });
});
