/**
 * What <GPUParticles3D> hands three for a trail: one skinned geometry when the material of the
 * draw pass sets `use_particle_trails`, else the whole mesh at the matrix of every section.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnInternalResource } from '../../../../parser/types';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { registeredComponent } from '../../../../r3f/testing/registeredComponent';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { loadParticleEmitter } from './emitterModule';
import { ALONG_X, BOX, emitterNode, ROW_OF_FOUR } from './gpuparticles3d.testkit';
import './index.r3f';

const GPUParticles3D = registeredComponent('GPUParticles3D');

const SECTIONS = 3;
const TRAIL_MATERIAL: TscnInternalResource = {
  id: 'Trailed',
  type: 'StandardMaterial3D',
  data: { use_particle_trails: 'true' },
};
const SKIN: TscnInternalResource = {
  id: 'Skin',
  type: 'Skin',
  data: {
    bind_count: '2',
    'bind/0/pose': 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
    'bind/1/pose': 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)',
  },
};
const PLAIN_MATERIAL: TscnInternalResource = { id: 'Plain', type: 'StandardMaterial3D', data: {} };

function ribbon(material: TscnInternalResource): TscnInternalResource {
  return {
    id: 'Ribbon',
    type: 'RibbonTrailMesh',
    data: { sections: String(SECTIONS), material: `SubResource("${material.id}")` },
  };
}

async function meshesOf(
  material: TscnInternalResource,
  properties: Record<string, string>,
  skin: TscnInternalResource = SKIN
) {
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={createFakeResourceLoader().loader}>
      <SceneResourcesProvider
        internalResources={[ALONG_X, BOX, ribbon(material), TRAIL_MATERIAL, PLAIN_MATERIAL, skin]}
        externalResources={[]}
      >
        <GPUParticles3D
          node={emitterNode({
            ...ROW_OF_FOUR,
            draw_pass_1: 'SubResource("Ribbon")',
            trail_enabled: 'true',
            ...properties,
          })}
        />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  return renderer.scene.findAll((node) => node.type === 'Mesh').map((node) => node.instance as THREE.Mesh);
}

// The component loads this chunk lazily, so it lands before the first render.
beforeAll(loadParticleEmitter);

describe('<GPUParticles3D> trail draw', () => {
  it('draws one skinned geometry for a material with use_particle_trails', async () => {
    const meshes = await meshesOf(TRAIL_MATERIAL, {});
    expect(meshes).toHaveLength(1);
    expect(meshes[0]).not.toBeInstanceOf(THREE.InstancedMesh);
    expect(meshes[0]!.geometry.getAttribute('skinIndex')).toBeUndefined();
  });

  it('keeps the vertices of every particle in the geometry', async () => {
    const [skinned] = await meshesOf(TRAIL_MATERIAL, {});
    const [single] = await meshesOf(TRAIL_MATERIAL, { amount: '1', preprocess: '1' });
    expect(skinned!.geometry.getAttribute('position').count).toBe(
      4 * single!.geometry.getAttribute('position').count
    );
  });

  it('draws the whole mesh at every section of a material without the flag', async () => {
    const [instanced] = await meshesOf(PLAIN_MATERIAL, {});
    expect((instanced as THREE.InstancedMesh).count).toBe(4 * (SECTIONS + 1));
  });

  it('draws the plain instances while trail_enabled is off (edge case)', async () => {
    const [instanced] = await meshesOf(TRAIL_MATERIAL, { trail_enabled: 'false' });
    expect((instanced as THREE.InstancedMesh).count).toBe(4);
  });

  it('takes the sections from draw_skin before the poses of the mesh', async () => {
    const [instanced] = await meshesOf(PLAIN_MATERIAL, { draw_skin: 'SubResource("Skin")' });
    expect((instanced as THREE.InstancedMesh).count).toBe(4 * 2);
  });

  it('draws plain instances for a draw_skin of one bind, which makes no trail (edge case)', async () => {
    const lone = { ...SKIN, data: { bind_count: '1' } };
    const [instanced] = await meshesOf(PLAIN_MATERIAL, { draw_skin: 'SubResource("Skin")' }, lone);
    expect((instanced as THREE.InstancedMesh).count).toBe(4);
  });
});
