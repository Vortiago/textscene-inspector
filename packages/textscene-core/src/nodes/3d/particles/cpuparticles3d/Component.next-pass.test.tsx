/**
 * A CPUParticles3D hands its mesh and its particle buffer to the surfaced mesh drawer, which
 * draws the `next_pass` chain of the emitter's material at every particle.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { loadParticleEmitter } from './emitterModule';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnInternalResource } from '../../../../parser/types';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { instanceAs } from '../../testing/reactThreeTestInstance';
import { registeredComponent } from '../../../../r3f/testing/registeredComponent';
import { nextPassRenderOrder } from '../../../../r3f/materials/passOrder';
import { BOX, ROW_OF_FOUR, emitterNode } from './cpuparticles3d.testkit';
import './index.r3f';

const CPUParticles3D = registeredComponent('CPUParticles3D');

const MATERIALS: TscnInternalResource[] = [
  BOX,
  {
    id: 'Pass',
    type: 'StandardMaterial3D',
    data: { albedo_color: 'Color(0, 1, 0, 1)', next_pass: 'SubResource("Link")' },
  },
  { id: 'Link', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 0, 1, 1)' } },
];

function emitter(properties: Record<string, string>) {
  return (
    <SceneResourcesProvider internalResources={MATERIALS} externalResources={[]}>
      <CPUParticles3D node={emitterNode(properties)} />
    </SceneResourcesProvider>
  );
}

// The component loads this chunk lazily, so it lands before the first render.
beforeAll(loadParticleEmitter);

describe('<CPUParticles3D> next_pass chain', () => {
  it('draws the chain link at every particle draw of the override', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      emitter({ ...ROW_OF_FOUR, material_override: 'SubResource("Pass")' })
    );
    const drawn = renderer.scene
      .findAll((node) => node.type === 'Mesh')
      .map((node) => instanceAs<THREE.InstancedMesh>(node));

    expect(drawn).toHaveLength(2);
    const [own, link] = drawn;
    expect(own!.count).toBe(4);
    expect(link!.count).toBe(4);
    // One draw per resolved link, of the geometry it covers, after it.
    expect(link!.geometry).toBe(own!.geometry);
    expect(link!.renderOrder).toBe(nextPassRenderOrder(1));
    const ownMaterial = own!.material as THREE.MeshStandardMaterial;
    const linkMaterial = link!.material as THREE.MeshStandardMaterial;
    expect(ownMaterial.color.getHex()).toBe(0x00ff00);
    expect(linkMaterial.color.getHex()).toBe(0x0000ff);
  });
});
