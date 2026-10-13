import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { AreaLight3D } from './Component';
import type { TscnNode } from '../../../../parser/types';
import type { AreaLight3DProperties } from './types';
import { LIGHT_INTENSITY_SCALE } from '../../../../r3f/lightConstants';
import { instanceAs } from '../../testing/reactThreeTestInstance';
import * as THREE from 'three';
import { areaLightUserData } from '../../../../r3f/areaLight/areaLightFalloff';
import { fireSceneRender } from '../../../../r3f/testing/fireSceneRender';
import { readFogLightDeclaration } from '../../../../r3f/fog/fogLightDeclaration';

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

/** Runs the hooks a render of the test scene runs, through a camera `distance` along +Z. */
function renderFrom(scene: THREE.Scene, distance: number): void {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, distance);
  camera.updateMatrixWorld();
  scene.updateMatrixWorld();
  fireSceneRender(scene, camera);
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
    expect(instanceAs<THREE.RectAreaLight>(light).userData).toMatchObject(
      areaLightUserData({ range: 2, attenuation: 0.5, specular: 0.25 })
    );
  });

  it('declares light_volumetric_fog_energy to the volumetric fog', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D node={makeNode({ light_volumetric_fog_energy: 2.5 })} />
    );
    const light = instanceAs<THREE.RectAreaLight>(renderer.scene.findByType('RectAreaLight'));
    expect(readFogLightDeclaration(light)).toEqual({ energy: 2.5 });
  });

  it("declares Godot's fog energy of 1 when the scene sets none (edge case)", async () => {
    const renderer = await ReactThreeTestRenderer.create(<AreaLight3D node={makeNode()} />);
    const light = instanceAs<THREE.RectAreaLight>(renderer.scene.findByType('RectAreaLight'));
    expect(readFogLightDeclaration(light)).toEqual({ energy: 1 });
  });

  it('subtracts light when light_negative is on', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D node={makeNode({ light_energy: 2.0, light_negative: true })} />
    );
    const light = renderer.scene.findByType('RectAreaLight');
    expect(instanceAs<THREE.RectAreaLight>(light).intensity).toBe(-2.0 * LIGHT_INTENSITY_SCALE);
  });

  it('fades by the distance to the rendering camera', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D
        node={makeNode({ distance_fade_enabled: true, distance_fade_begin: 10, distance_fade_length: 4 })}
      />
    );
    const light = instanceAs<THREE.RectAreaLight>(renderer.scene.findByType('RectAreaLight'));

    renderFrom(renderer.scene.instance as THREE.Scene, 12);
    // smoothstep(0, 1, 1 - (12 - 10) / 4) is 0.5.
    expect(light.intensity).toBeCloseTo(0.5 * LIGHT_INTENSITY_SCALE, 6);
  });

  it('draws nothing past the end of the fade (edge case)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D
        node={makeNode({ distance_fade_enabled: true, distance_fade_begin: 1, distance_fade_length: 1 })}
      />
    );
    const light = instanceAs<THREE.RectAreaLight>(renderer.scene.findByType('RectAreaLight'));

    renderFrom(renderer.scene.instance as THREE.Scene, 50);
    expect(light.intensity).toBe(0);
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
