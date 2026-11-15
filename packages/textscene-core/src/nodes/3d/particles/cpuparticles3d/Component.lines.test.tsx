/**
 * A CPUParticles3D whose mesh draws lines: one THREE.LineSegments instanced at every particle, as
 * Godot draws each particle as an instance with its own MODEL_MATRIX.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnInternalResource } from '../../../../parser/types';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { registeredComponent } from '../../../../r3f/testing/registeredComponent';
import { wallQuadSurfaces } from '../../../../resources/testing/arrayMeshSurfaces';
import { instanceMatrices } from '../../../../r3f/meshes/sharedInstances';
import { instanceAs } from '../../testing/reactThreeTestInstance';
import { emitterNode, ROW_OF_FOUR } from './cpuparticles3d.testkit';
import { loadParticleEmitter } from './emitterModule';
import './index.r3f';

const CPUParticles3D = registeredComponent('CPUParticles3D');

const WIRE: TscnInternalResource = {
  id: 'Wire',
  type: 'ArrayMesh',
  data: { _surfaces: wallQuadSurfaces({ name: 'wire', primitive: 1 }) },
};

async function drawnLines(): Promise<THREE.LineSegments[]> {
  const rendered = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={[WIRE]} externalResources={[]}>
      <CPUParticles3D node={emitterNode({ ...ROW_OF_FOUR, mesh: 'SubResource("Wire")' })} />
    </SceneResourcesProvider>
  );
  return rendered.scene.findAllByType('LineSegments').map((node) => instanceAs<THREE.LineSegments>(node));
}

// The component loads this chunk lazily, so it lands before the first render.
beforeAll(loadParticleEmitter);

describe('<CPUParticles3D> with a lines mesh', () => {
  it('instances one LineSegments at every particle', async () => {
    const [lines, ...others] = await drawnLines();
    const geometry = lines!.geometry as THREE.InstancedBufferGeometry;

    expect(others).toEqual([]);
    expect([geometry.instanceCount, instanceMatrices(geometry).count]).toEqual([4, 4]);
  });
});
