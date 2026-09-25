import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { OmniLight3D } from './Component';
import type { TscnNode } from '../../../../parser/types';
import type { OmniLight3DProperties } from './types';
import { LIGHT_INTENSITY_SCALE } from '../../../../r3f/lightConstants';
import { instanceAs } from '../../testing/reactThreeTestInstance';

function makeNode(overrides: Partial<OmniLight3DProperties> = {}): TscnNode {
  const props: OmniLight3DProperties = {
    name: 'Lamp',
    light_color: 'Color(1, 1, 1, 1)',
    light_energy: 1,
    shadow_enabled: false,
    omni_range: 5,
    omni_attenuation: 2,
    ...overrides,
  };
  return { name: props.name ?? 'Lamp', type: 'OmniLight3D', children: [], properties: props };
}

describe('<OmniLight3D>', () => {
  it('renders a PointLight', async () => {
    const renderer = await ReactThreeTestRenderer.create(<OmniLight3D node={makeNode()} />);
    expect(renderer.scene.findAllByType('PointLight').length).toBe(1);
  });

  it('converts shadow_bias at the shadow camera’s far plane', async () => {
    // Godot's default 0.1 is a world radial offset. At the 0.5 near and this
    // light's range-5 far, that is 0.1 * 0.5 / (5 * 4.5) of three's cube depth.
    const renderer = await ReactThreeTestRenderer.create(
      <OmniLight3D node={makeNode({ shadow_enabled: true })} />
    );
    const light = renderer.scene.findByType('PointLight');
    expect(instanceAs<THREE.PointLight>(light).shadow.bias).toBeCloseTo(-1 / 450, 12);
  });

  it('rescales shadow_bias with the light’s own range', async () => {
    // 0.2 * 0.5 / (10 * 9.5).
    const renderer = await ReactThreeTestRenderer.create(
      <OmniLight3D node={makeNode({ shadow_enabled: true, shadow_bias: 0.2, omni_range: 10 })} />
    );
    const light = renderer.scene.findByType('PointLight');
    expect(instanceAs<THREE.PointLight>(light).shadow.bias).toBeCloseTo(-0.1 / 95, 12);
  });

  it('maps omni_range to distance', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OmniLight3D node={makeNode({ omni_range: 12 })} />
    );
    const light = renderer.scene.findByType('PointLight');
    expect(instanceAs<THREE.PointLight>(light).distance).toBe(12);
  });

  it('maps omni_attenuation to decay', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OmniLight3D node={makeNode({ omni_attenuation: 3 })} />
    );
    const light = renderer.scene.findByType('PointLight');
    expect(instanceAs<THREE.PointLight>(light).decay).toBe(3);
  });

  it('applies energy * LIGHT_INTENSITY_SCALE as intensity', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OmniLight3D node={makeNode({ light_energy: 1.5 })} />
    );
    const light = renderer.scene.findByType('PointLight');
    expect(instanceAs<THREE.PointLight>(light).intensity).toBe(1.5 * LIGHT_INTENSITY_SCALE);
  });

  it('places light at the transform origin', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OmniLight3D node={makeNode({
        name: 'Pos',
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 3, y: 4, z: 5 },
        },
      })} />
    );
    const light = renderer.scene.findByProps({ name: 'Pos' });
    expect(light.instance.position.x).toBe(3);
    expect(light.instance.position.y).toBe(4);
    expect(light.instance.position.z).toBe(5);
  });
});
