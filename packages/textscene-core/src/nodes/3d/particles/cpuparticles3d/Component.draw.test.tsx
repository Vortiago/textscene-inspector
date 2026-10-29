/**
 * What <CPUParticles3D> hands three: one instance of the mesh per particle, posed and coloured as
 * Godot's buffer writes it, under materials that read the instance data.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';
import { heading } from '../../../../parser/testing/parserKit';
import { findMesh } from '../../testing/reactThreeTestInstance';
import { registeredComponent } from '../../../../r3f/testing/registeredComponent';
import { PARTICLE_COLOR_ATTRIBUTE } from '../../../../r3f/materials/godotParticles';
import { parseCPUParticles3D } from './parser';
import './index.r3f';

const CPUParticles3D = registeredComponent('CPUParticles3D');

const BOX: TscnInternalResource = { id: 'Box', type: 'BoxMesh', data: { size: 'Vector3(0.2, 0.2, 0.2)' } };

const ROW_OF_FOUR = {
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

function emitter(properties: Record<string, string>): TscnNode {
  return {
    rawProperties: {},
    name: 'Row',
    type: 'CPUParticles3D',
    children: [],
    properties: parseCPUParticles3D(heading('CPUParticles3D', { name: 'Row' }), properties),
  } as TscnNode;
}

async function render(properties: Record<string, string>) {
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={[BOX]} externalResources={[]}>
      <CPUParticles3D node={emitter(properties)} />
    </SceneResourcesProvider>
  );
}

async function particles(properties: Record<string, string> = ROW_OF_FOUR): Promise<THREE.InstancedMesh> {
  return findMesh((await render(properties)).scene) as THREE.InstancedMesh;
}

describe('<CPUParticles3D> draw', () => {
  it('draws one instance of the mesh per particle', async () => {
    expect((await particles()).count).toBe(4);
  });

  // The oldest particle has flown 1.5 s at 1 unit a second (`simulate.test.ts`).
  it("places each instance at its particle's origin", async () => {
    const mesh = await particles();
    const origins = [0, 1, 2, 3].map((i) => {
      const matrix = new THREE.Matrix4();
      mesh.getMatrixAt(i, matrix);
      return new THREE.Vector3().setFromMatrixPosition(matrix).x;
    });
    expect(origins.map((x) => Number(x.toFixed(5)))).toEqual([1.5, 1, 0.5, 0]);
  });

  it("gives each instance its particle's colour", async () => {
    const colors = (await particles()).geometry.getAttribute(PARTICLE_COLOR_ATTRIBUTE);
    expect(Array.from(colors.array.slice(0, 4))).toEqual([1, 0.5, 0, 1]);
  });

  it('draws nothing while the emitter is off', async () => {
    const renderer = await render({ ...ROW_OF_FOUR, emitting: 'false' });
    expect(renderer.scene.findAll((node) => node.type === 'Mesh')).toHaveLength(0);
  });

  it('draws nothing for an emitter with no mesh (edge case)', async () => {
    const { mesh: _mesh, ...meshless } = ROW_OF_FOUR;
    const renderer = await render(meshless);
    expect(renderer.scene.findAll((node) => node.type === 'Mesh')).toHaveLength(0);
  });
});
