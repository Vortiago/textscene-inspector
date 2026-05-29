import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { OmniLight3D } from './Component';
import type { TscnNode } from '../../../../parser/types';
import type { OmniLight3DProperties } from '../../../../nodes/3d/lights/omnilight3d/types';
import { LIGHT_INTENSITY_SCALE } from '../../../../utils/lightConstants';

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

  it('maps omni_range to distance', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OmniLight3D node={makeNode({ omni_range: 12 })} />
    );
    const light = renderer.scene.findByType('PointLight');
    expect((light.instance as { distance: number }).distance).toBe(12);
  });

  it('maps omni_attenuation to decay', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OmniLight3D node={makeNode({ omni_attenuation: 3 })} />
    );
    const light = renderer.scene.findByType('PointLight');
    expect((light.instance as { decay: number }).decay).toBe(3);
  });

  it('applies energy * LIGHT_INTENSITY_SCALE as intensity', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OmniLight3D node={makeNode({ light_energy: 1.5 })} />
    );
    const light = renderer.scene.findByType('PointLight');
    expect((light.instance as { intensity: number }).intensity).toBe(1.5 * LIGHT_INTENSITY_SCALE);
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
