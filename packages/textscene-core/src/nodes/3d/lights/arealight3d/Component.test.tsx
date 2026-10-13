import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { AreaLight3D } from './Component';
import type { TscnNode } from '../../../../parser/types';
import type { AreaLight3DProperties } from './types';
import { LIGHT_INTENSITY_SCALE } from '../../../../r3f/lightConstants';
import { instanceAs } from '../../testing/reactThreeTestInstance';
import type * as THREE from 'three';
import { areaLightUserData } from '../../../../r3f/areaLight/areaLightFalloff';

function makeNode(overrides: Partial<AreaLight3DProperties> = {}): TscnNode {
  const props: AreaLight3DProperties = {
    name: 'Area',
    light_color: 'Color(1, 1, 1, 1)',
    light_energy: 1,
    light_specular: 1,
    shadow_enabled: false,
    area_range: 5,
    area_attenuation: 1,
    area_size: { x: 1, y: 1 },
    area_normalize_energy: true,
    ...overrides,
  };
  return {
    rawProperties: {},
    name: props.name ?? 'Area',
    type: 'AreaLight3D',
    children: [],
    properties: props,
  };
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
    expect(instanceAs<THREE.RectAreaLight>(light).width).toBe(4);
  });

  it('maps area_size height to RectAreaLight height', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D node={makeNode({ area_size: { x: 2, y: 3 } })} />
    );
    const light = renderer.scene.findByType('RectAreaLight');
    expect(instanceAs<THREE.RectAreaLight>(light).height).toBe(3);
  });

  it('applies energy * LIGHT_INTENSITY_SCALE as intensity', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D node={makeNode({ light_energy: 2.0 })} />
    );
    const light = renderer.scene.findByType('RectAreaLight');
    expect(instanceAs<THREE.RectAreaLight>(light).intensity).toBe(2.0 * LIGHT_INTENSITY_SCALE);
  });

  it('casts no shadow yet, even when shadow_enabled is true', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D node={makeNode({ shadow_enabled: true })} />
    );
    const light = renderer.scene.findByType('RectAreaLight');
    expect((light.instance as { castShadow: boolean }).castShadow).toBe(false);
  });

  it('carries area_range, area_attenuation and light_specular to the shader', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D node={makeNode({ area_range: 2, area_attenuation: 0.5, light_specular: 0.25 })} />
    );
    const light = renderer.scene.findByType('RectAreaLight');
    expect(instanceAs<THREE.RectAreaLight>(light).userData).toEqual(
      areaLightUserData({ range: 2, attenuation: 0.5, specular: 0.25 })
    );
  });

  it('subtracts light when light_negative is on', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D node={makeNode({ light_energy: 2.0, light_negative: true })} />
    );
    const light = renderer.scene.findByType('RectAreaLight');
    expect(instanceAs<THREE.RectAreaLight>(light).intensity).toBe(-2.0 * LIGHT_INTENSITY_SCALE);
  });

  it('places light at the transform origin', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D
        node={makeNode({
          name: 'Pos',
          transform: {
            basis_x: { x: 1, y: 0, z: 0 },
            basis_y: { x: 0, y: 1, z: 0 },
            basis_z: { x: 0, y: 0, z: 1 },
            origin: { x: 3, y: 4, z: 5 },
          },
        })}
      />
    );
    const group = renderer.scene.findByProps({ name: 'Pos' });
    expect(group.instance.position.x).toBe(3);
    expect(group.instance.position.y).toBe(4);
    expect(group.instance.position.z).toBe(5);
  });
});

describe('<AreaLight3D> visibility', () => {
  // A hidden light lights nothing (`light_3d.cpp:300` in 4.6.3), and three skips a hidden subtree.
  it('hides the light when visible is false', async () => {
    const renderer = await ReactThreeTestRenderer.create(<AreaLight3D node={makeNode({ visible: false })} />);
    const light = instanceAs<THREE.RectAreaLight>(renderer.scene.findByType('RectAreaLight'));
    expect(light.parent!.visible).toBe(false);
  });

  it('shows the light by default', async () => {
    const renderer = await ReactThreeTestRenderer.create(<AreaLight3D node={makeNode()} />);
    const light = instanceAs<THREE.RectAreaLight>(renderer.scene.findByType('RectAreaLight'));
    expect(light.parent!.visible).toBe(true);
  });
});
