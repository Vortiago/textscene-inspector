import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { AreaLight3D } from './Component';
import type { TscnNode } from '../../../../parser/types';
import type { AreaLight3DProperties } from './types';
import { LIGHT_INTENSITY_SCALE } from '../../../../r3f/lightConstants';

function makeNode(overrides: Partial<AreaLight3DProperties> = {}): TscnNode {
  const props: AreaLight3DProperties = {
    name: 'Area',
    light_color: 'Color(1, 1, 1, 1)',
    light_energy: 1,
    shadow_enabled: false,
    ...overrides,
  };
  return { name: props.name ?? 'Area', type: 'AreaLight3D', children: [], properties: props };
}

describe('<AreaLight3D>', () => {
  it('renders a RectAreaLight', async () => {
    const renderer = await ReactThreeTestRenderer.create(<AreaLight3D node={makeNode()} />);
    expect(renderer.scene.findAllByType('RectAreaLight').length).toBe(1);
  });

  it('maps area_size width to RectAreaLight width', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D node={makeNode({ area_size: { x: 4, y: 1 } })} />
    );
    const light = renderer.scene.findByType('RectAreaLight');
    expect((light.instance as { width: number }).width).toBe(4);
  });

  it('maps area_size height to RectAreaLight height', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D node={makeNode({ area_size: { x: 2, y: 3 } })} />
    );
    const light = renderer.scene.findByType('RectAreaLight');
    expect((light.instance as { height: number }).height).toBe(3);
  });

  it('defaults to width=1, height=1 when area_size is absent', async () => {
    const renderer = await ReactThreeTestRenderer.create(<AreaLight3D node={makeNode({ area_size: undefined })} />);
    const light = renderer.scene.findByType('RectAreaLight');
    expect((light.instance as { width: number }).width).toBe(1);
    expect((light.instance as { height: number }).height).toBe(1);
  });

  it('applies energy * LIGHT_INTENSITY_SCALE as intensity', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D node={makeNode({ light_energy: 2.0 })} />
    );
    const light = renderer.scene.findByType('RectAreaLight');
    expect((light.instance as { intensity: number }).intensity).toBe(2.0 * LIGHT_INTENSITY_SCALE);
  });

  it('does not cast shadows even when shadow_enabled is true (RectAreaLight has no shadow support)', async () => {
    // Pins the intentional lossy mapping: shadow_* is parsed + lint-validated
    // but silently dropped at render (see Component.tsx header) — so a future
    // edit can't quietly start wiring castShadow onto a light that can't cast.
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D node={makeNode({ shadow_enabled: true })} />
    );
    const light = renderer.scene.findByType('RectAreaLight');
    expect((light.instance as { castShadow: boolean }).castShadow).toBe(false);
  });

  it('does not leak area_range onto the RectAreaLight', async () => {
    // area_range is carried on the parsed node but intentionally not applied
    // (three.js RectAreaLight has no range/penumbra control).
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D node={makeNode({ area_range: 2.0 } as Partial<AreaLight3DProperties>)} />
    );
    const light = renderer.scene.findByType('RectAreaLight');
    expect((light.instance as Record<string, unknown>).area_range).toBeUndefined();
  });

  it('places light at the transform origin', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D node={makeNode({
        name: 'Pos',
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 3, y: 4, z: 5 },
        },
      })} />
    );
    const group = renderer.scene.findByProps({ name: 'Pos' });
    expect(group.instance.position.x).toBe(3);
    expect(group.instance.position.y).toBe(4);
    expect(group.instance.position.z).toBe(5);
  });
});
