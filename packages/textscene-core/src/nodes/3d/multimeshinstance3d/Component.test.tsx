/**
 * What <MultiMeshInstance3D> hands three: its mesh once for each drawn instance, placed and
 * coloured as the MultiMesh buffer writes it.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { makeNode } from '../../../parser/testing/parserKit';
import { PARTICLE_COLOR_ATTRIBUTE } from '../../../r3f/materials/godotParticles';
import { INSTANCE_CUSTOM_ATTRIBUTE, instanceMatrices } from '../../../r3f/meshes/sharedInstances';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { registeredComponent } from '../../../r3f/testing/registeredComponent';
import { isInstancedMesh } from '../../../r3f/testing/threeNarrow';
import { instanceAs } from '../testing/reactThreeTestInstance';
import './index';
import './index.r3f';

const MultiMeshInstance3D = registeredComponent('MultiMeshInstance3D');

const BOX: TscnInternalResource = { id: 'box', type: 'BoxMesh', data: {} };

/** Four half-size boxes along x, each with a colour and custom data. */
const FOUR_INSTANCES = {
  transform_format: '1',
  use_colors: 'true',
  use_custom_data: 'true',
  instance_count: '4',
  mesh: 'SubResource("box")',
  buffer: `PackedFloat32Array(${[0, 1, 2, 3]
    .flatMap((i) => [0.5, 0, 0, i, 0, 0.5, 0, 0, 0, 0, 0.5, 0, i / 4, 0.5, 0, 1, i, i + 1, i + 2, i + 3])
    .join(', ')})`,
};

async function render(multimesh: TscnInternalResource | null) {
  const node = makeNode('MM', 'MultiMeshInstance3D', {
    rawProperties: multimesh ? { multimesh: 'SubResource("mm")' } : {},
  });
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={multimesh ? [BOX, multimesh] : [BOX]} externalResources={[]}>
      <MultiMeshInstance3D node={node}>
        <object3D name="child" />
      </MultiMeshInstance3D>
    </SceneResourcesProvider>
  );
}

function multiMesh(data: Record<string, string>): TscnInternalResource {
  return { id: 'mm', type: 'MultiMesh', data };
}

function instancedDraws(renderer: Awaited<ReturnType<typeof render>>): THREE.InstancedMesh[] {
  return renderer.scene
    .findAllByType('Mesh')
    .map((mesh) => instanceAs<THREE.Mesh>(mesh))
    .filter(isInstancedMesh);
}

async function drawn(data: Record<string, string>): Promise<THREE.InstancedMesh> {
  return instancedDraws(await render(multiMesh(data)))[0]!;
}

describe('<MultiMeshInstance3D> draw', () => {
  it('draws no mesh for a node with no multimesh, and mounts its children', async () => {
    const renderer = await render(null);
    expect(instancedDraws(renderer)).toHaveLength(0);
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });

  it('draws no mesh for a MultiMesh with no mesh, and mounts its children', async () => {
    const renderer = await render(multiMesh({ instance_count: '4' }));
    expect(instancedDraws(renderer)).toHaveLength(0);
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });

  it('draws one instanced mesh of the instance count, and mounts the children', async () => {
    const renderer = await render(multiMesh(FOUR_INSTANCES));
    expect(instancedDraws(renderer).map((mesh) => mesh.count)).toEqual([4]);
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });

  it('draws the first visible_instance_count instances', async () => {
    expect((await drawn({ ...FOUR_INSTANCES, visible_instance_count: '2' })).count).toBe(2);
  });

  it('draws nothing for a visible_instance_count of 0', async () => {
    const renderer = await render(multiMesh({ ...FOUR_INSTANCES, visible_instance_count: '0' }));
    expect(instancedDraws(renderer).map((mesh) => mesh.count)).toEqual([0]);
  });

  it('places each instance at the origin its buffer row holds', async () => {
    const matrices = instanceMatrices((await drawn(FOUR_INSTANCES)).geometry);
    const origins = [0, 1, 2, 3].map((i) => matrices.array[i * 16 + 12]);
    expect(origins).toEqual([0, 1, 2, 3]);
  });

  it('gives each instance the colour and the custom data of its row', async () => {
    const { geometry } = await drawn(FOUR_INSTANCES);
    const colours = geometry.getAttribute(PARTICLE_COLOR_ATTRIBUTE).array;
    const customs = geometry.getAttribute(INSTANCE_CUSTOM_ATTRIBUTE).array;
    expect([Array.from(colours.slice(4, 8)), Array.from(customs.slice(4, 8))]).toEqual([
      [0.25, 0.5, 0, 1],
      [1, 2, 3, 4],
    ]);
  });

  it('draws a MultiMesh with no buffer as degenerate instances, one for each instance_count', async () => {
    const mesh = await drawn({ transform_format: '1', instance_count: '3', mesh: 'SubResource("box")' });
    expect([mesh.count, Array.from(instanceMatrices(mesh.geometry).array.slice(0, 16))]).toEqual([
      3,
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    ]);
  });
});
