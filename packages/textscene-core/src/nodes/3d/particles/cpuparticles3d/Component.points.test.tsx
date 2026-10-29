/**
 * A CPUParticles3D whose mesh draws points: one THREE.Points instanced at every particle, as Godot
 * draws each particle as an instance with its own MODEL_MATRIX.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnInternalResource } from '../../../../parser/types';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { registeredComponent } from '../../../../r3f/testing/registeredComponent';
import { instanceMatrices } from '../../../../r3f/meshes/sharedInstances';
import { instanceAs } from '../../testing/reactThreeTestInstance';
import { emitterNode, ROW_OF_FOUR } from './cpuparticles3d.testkit';
import { loadSimulate } from './simulateModule';
import './index.r3f';

const CPUParticles3D = registeredComponent('CPUParticles3D');

/** A PointMesh under a StandardMaterial3D that `mapping` sets up. */
function pointMeshUnder(mapping: string): TscnInternalResource[] {
  const data = Object.fromEntries(mapping.split('\n').map((line) => line.split(' = ') as [string, string]));
  return [
    { id: 'Projected', type: 'StandardMaterial3D', data },
    { id: 'Dot', type: 'PointMesh', data: { material: 'SubResource("Projected")' } },
  ];
}

async function drawnPoints(mapping: string): Promise<THREE.Points[]> {
  const rendered = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={pointMeshUnder(mapping)} externalResources={[]}>
      <CPUParticles3D node={emitterNode({ ...ROW_OF_FOUR, mesh: 'SubResource("Dot")' })} />
    </SceneResourcesProvider>
  );
  return rendered.scene.findAllByType('Points').map((node) => instanceAs<THREE.Points>(node));
}

// The component loads this chunk lazily, so it lands before the first render.
beforeAll(loadSimulate);

describe('<CPUParticles3D> with a PointMesh', () => {
  it('instances one Points at every particle, so a local triplanar reads each MODEL_MATRIX', async () => {
    const [points, ...others] = await drawnPoints('uv1_triplanar = true');
    const geometry = points!.geometry as THREE.InstancedBufferGeometry;

    expect(others).toEqual([]);
    expect([geometry.instanceCount, instanceMatrices(geometry).count]).toEqual([4, 4]);
    expect((points!.material as THREE.Material).userData.godotPointsAtInstances).toBe(true);
  });

  it("places each instance at its particle's origin", async () => {
    const [points] = await drawnPoints('uv1_triplanar = true');
    const matrices = instanceMatrices(points!.geometry);
    // The ROW_OF_FOUR buffer holds each origin's x in its first row's last float.
    const originsX = Array.from({ length: 4 }, (_, i) => matrices.array[i * 16 + 12]);

    expect(originsX).toEqual([1.4999998807907104, 1.0000003576278687, 0.5, 1.3322676295501878e-15]);
  });
});
