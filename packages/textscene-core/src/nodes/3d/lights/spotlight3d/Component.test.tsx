import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SpotLight3D } from './Component';
import type { TscnNode } from '../../../../parser/types';
import type { SpotLight3DProperties } from './types';
import { LIGHT_INTENSITY_SCALE } from '../../../../utils/lightConstants';

function makeNode(overrides: Partial<SpotLight3DProperties> = {}): TscnNode {
  const props: SpotLight3DProperties = {
    name: 'Torch',
    light_color: 'Color(1, 1, 1, 1)',
    light_energy: 1,
    shadow_enabled: false,
    spot_range: 10,
    spot_angle: 30,
    ...overrides,
  };
  return { name: props.name ?? 'Torch', type: 'SpotLight3D', children: [], properties: props };
}

describe('<SpotLight3D>', () => {
  it('renders a SpotLight', async () => {
    const renderer = await ReactThreeTestRenderer.create(<SpotLight3D node={makeNode()} />);
    expect(renderer.scene.findAllByType('SpotLight').length).toBe(1);
  });

  it('converts spot_angle from degrees to radians', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SpotLight3D node={makeNode({ spot_angle: 90 })} />
    );
    const light = renderer.scene.findByType('SpotLight');
    expect((light.instance as { angle: number }).angle).toBeCloseTo(Math.PI / 2, 5);
  });

  it('maps spot_range to distance', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SpotLight3D node={makeNode({ spot_range: 25 })} />
    );
    const light = renderer.scene.findByType('SpotLight');
    expect((light.instance as { distance: number }).distance).toBe(25);
  });

  it('applies penumbra (defaults to 0.1)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<SpotLight3D node={makeNode()} />);
    const light = renderer.scene.findByType('SpotLight');
    expect((light.instance as { penumbra: number }).penumbra).toBe(0.1);
  });

  it('overrides default penumbra when supplied', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SpotLight3D node={makeNode({ penumbra: 0.5 })} />
    );
    const light = renderer.scene.findByType('SpotLight');
    expect((light.instance as { penumbra: number }).penumbra).toBe(0.5);
  });

  it('applies energy * LIGHT_INTENSITY_SCALE as intensity', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SpotLight3D node={makeNode({ light_energy: 2 })} />
    );
    const light = renderer.scene.findByType('SpotLight');
    expect((light.instance as { intensity: number }).intensity).toBe(2 * LIGHT_INTENSITY_SCALE);
  });
});
