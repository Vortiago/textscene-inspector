/**
 * A CPUParticles3D whose mesh draws points: every particle's points in one THREE.Points, and the
 * item's own space beside them for a material that reads it, as Godot draws each particle as an
 * instance with its own MODEL_MATRIX.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnInternalResource } from '../../../../parser/types';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { registeredComponent } from '../../../../r3f/testing/registeredComponent';
import { PLACED_POINT_ATTRIBUTES } from '../../../../r3f/materials/godotPoint';
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
  it("gives each particle's point its item's space under local triplanar", async () => {
    const [points, ...others] = await drawnPoints('uv1_triplanar = true');

    expect(others).toEqual([]);
    expect(points!.geometry.getAttribute(PLACED_POINT_ATTRIBUTES.itemPosition).count).toBe(4);
    expect(points!.geometry.getAttribute(PLACED_POINT_ATTRIBUTES.placeMatrix).count).toBe(4);
    expect((points!.material as THREE.Material).userData.godotPointsAtPlaces).toBe(true);
  });

  it('leaves out the item space under world triplanar, as it costs a mat4 per point', async () => {
    const [points] = await drawnPoints('uv1_triplanar = true\nuv1_world_triplanar = true');

    expect(points!.geometry.getAttribute(PLACED_POINT_ATTRIBUTES.placeMatrix)).toBeUndefined();
    expect((points!.material as THREE.Material).userData.godotPointsAtPlaces).toBe(false);
  });
});
