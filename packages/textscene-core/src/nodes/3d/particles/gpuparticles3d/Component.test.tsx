import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Node3D } from '../../../base/node3d/Component';
import type { Node3DProperties, Transform3D } from '../../../base/node3d/types';
import type { TscnNode } from '../../../../parser/types';

function makeNode(properties: Node3DProperties): TscnNode {
  return { name: properties.name ?? 'GPUParticles3D', type: 'GPUParticles3D' as const, children: [], properties };
}

function gpuNode(): TscnNode {
  return makeNode({ name: 'MyGPUParticles' });
}

describe('<Node3D> (gpuparticles3d component)', () => {
  it('renders a named group', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Node3D node={gpuNode()} />);
    expect(renderer.scene.findByProps({ name: 'MyGPUParticles' })).toBeDefined();
  });

  it('applies transform origin to position', async () => {
    const idTransform: Transform3D = {
      basis_x: { x: 1, y: 0, z: 0 },
      basis_y: { x: 0, y: 1, z: 0 },
      basis_z: { x: 0, y: 0, z: 1 },
      origin: { x: 1, y: 2, z: 3 },
    };
    const renderer = await ReactThreeTestRenderer.create(
      <Node3D node={makeNode({ name: 'Positioned', transform: idTransform })} />
    );
    const group = renderer.scene.findByProps({ name: 'Positioned' });
    expect(group.instance.position.x).toBe(1);
    expect(group.instance.position.y).toBe(2);
    expect(group.instance.position.z).toBe(3);
  });

  it('hides the group when visible is false, without crashing', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Node3D node={makeNode({ name: 'HiddenParticles', visible: false })} />
    );
    const group = renderer.scene.findByProps({ name: 'HiddenParticles' });
    expect(group.instance.visible).toBe(false);
  });
});
