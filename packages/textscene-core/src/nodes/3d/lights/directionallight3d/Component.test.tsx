import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { DirectionalLight3D } from './Component';
import type { TscnNode } from '../../../../parser/types';
import type { DirectionalLight3DProperties } from './types';
import { LIGHT_INTENSITY_SCALE } from '../../../../r3f/lightConstants';
import { instanceAs } from '../../testing/reactThreeTestInstance';
import { readDirectionalShadowDeclaration } from '../../../../r3f/directionalShadow/declaration';

function makeNode(overrides: Partial<DirectionalLight3DProperties> = {}): TscnNode {
  const props: DirectionalLight3DProperties = {
    name: 'Sun',
    light_color: 'Color(1, 0.95, 0.9, 1)',
    light_energy: 0.8,
    shadow_enabled: false,
    ...overrides,
  };
  return { name: props.name ?? 'Sun', type: 'DirectionalLight3D', children: [], properties: props };
}

describe('<DirectionalLight3D>', () => {
  it('renders a DirectionalLight', async () => {
    const renderer = await ReactThreeTestRenderer.create(<DirectionalLight3D node={makeNode()} />);
    expect(renderer.scene.findAllByType('DirectionalLight').length).toBe(1);
  });

  it('applies energy * LIGHT_INTENSITY_SCALE as intensity', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={makeNode({ light_energy: 2 })} />
    );
    const light = renderer.scene.findByType('DirectionalLight');
    expect(instanceAs<THREE.DirectionalLight>(light).intensity).toBe(2 * LIGHT_INTENSITY_SCALE);
  });

  it('declares shadow_bias through Godot’s own normalised-depth arithmetic', async () => {
    // 0.5 / 100 * soft_shadow_scale(2) = 0.01, negated for three's compare.
    const renderer = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={makeNode({ shadow_enabled: true, shadow_bias: 0.5 })} />
    );
    const light = instanceAs<THREE.DirectionalLight>(renderer.scene.findByType('DirectionalLight'));
    expect(readDirectionalShadowDeclaration(light)?.depthBias).toBeCloseTo(-0.01, 12);
  });

  it('defaults an absent shadow_bias to Godot’s own default', async () => {
    // `light_3d.cpp:490`: 0.1 / 100 * 2 = 0.002.
    const renderer = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={makeNode({ shadow_enabled: true })} />
    );
    const light = instanceAs<THREE.DirectionalLight>(renderer.scene.findByType('DirectionalLight'));
    expect(readDirectionalShadowDeclaration(light)?.depthBias).toBeCloseTo(-0.002, 12);
  });

  it('parses light_color hex', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={makeNode({ light_color: 'Color(1, 0, 0, 1)' })} />
    );
    const light = renderer.scene.findByType('DirectionalLight');
    expect(instanceAs<THREE.DirectionalLight>(light).color.getHex()).toBe(0xff0000);
  });

  it('enables castShadow when shadow_enabled is true', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={makeNode({ shadow_enabled: true })} />
    );
    const light = renderer.scene.findByType('DirectionalLight');
    expect((light.instance as { castShadow: boolean }).castShadow).toBe(true);
  });

  it('positions light group at transform origin', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={makeNode({
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 0, y: 10, z: 0 },
        },
      })} />
    );
    const group = renderer.scene.findByProps({ name: 'Sun' });
    expect(group.instance.position.y).toBe(10);
  });
});

describe('<DirectionalLight3D> shadow declaration', () => {
  it('declares the authored max distance and pancake size', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <DirectionalLight3D
        node={makeNode({
          shadow_enabled: true,
          directional_shadow_max_distance: 80,
          directional_shadow_pancake_size: 5,
          shadow_normal_bias: 1.5,
        })}
      />
    );
    const light = instanceAs<THREE.DirectionalLight>(renderer.scene.findByType('DirectionalLight'));
    expect(readDirectionalShadowDeclaration(light)).toMatchObject({
      maxDistance: 80,
      pancakeSize: 5,
      normalBias: 1.5,
    });
  });

  it('declares Godot’s defaults for an absent max distance, pancake size and normal bias', async () => {
    // `light_3d.cpp:600`, `:487` and `:603`.
    const renderer = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={makeNode({ shadow_enabled: true })} />
    );
    const light = instanceAs<THREE.DirectionalLight>(renderer.scene.findByType('DirectionalLight'));
    expect(readDirectionalShadowDeclaration(light)).toMatchObject({
      maxDistance: 100,
      pancakeSize: 20,
      normalBias: 2,
    });
  });

  it('draws into a map of Godot’s default directional shadow size', async () => {
    // `rendering_server.cpp:3704`.
    const renderer = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={makeNode({ shadow_enabled: true })} />
    );
    const light = instanceAs<THREE.DirectionalLight>(renderer.scene.findByType('DirectionalLight'));
    expect(light.shadow.mapSize.toArray()).toEqual([4096, 4096]);
  });

  it('leaves the shadow camera to the scene fitter, and the light at its node', async () => {
    // The node's position plays no part in Godot's directional shadow, and the
    // helper, selection box and F-to-frame stay at the node.
    const renderer = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={makeNode({ shadow_enabled: true })} />
    );
    const light = instanceAs<THREE.DirectionalLight>(renderer.scene.findByType('DirectionalLight'));
    const untouched = new THREE.DirectionalLight().shadow.camera;
    expect(light.position.length()).toBe(0);
    expect(light.shadow.camera.left).toBe(untouched.left);
    expect(light.shadow.camera.near).toBe(untouched.near);
  });
});
