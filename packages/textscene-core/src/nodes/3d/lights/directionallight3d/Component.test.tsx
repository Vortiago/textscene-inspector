import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { DirectionalLight3D } from './Component';
import type { TscnNode } from '../../../../parser/types';
import type { DirectionalLight3DProperties } from './types';
import { LIGHT_INTENSITY_SCALE } from '../../../../r3f/lightConstants';

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
    expect((light.instance as THREE.DirectionalLight).intensity).toBe(2 * LIGHT_INTENSITY_SCALE);
  });

  it('parses light_color hex', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={makeNode({ light_color: 'Color(1, 0, 0, 1)' })} />
    );
    const light = renderer.scene.findByType('DirectionalLight');
    expect((light.instance as THREE.DirectionalLight).color.getHex()).toBe(0xff0000);
  });

  it('enables castShadow when shadow_enabled is true', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={makeNode({ shadow_enabled: true })} />
    );
    const light = renderer.scene.findByType('DirectionalLight');
    expect((light.instance as THREE.DirectionalLight).castShadow).toBe(true);
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

describe('<DirectionalLight3D> shadow frustum', () => {
  it('sits back from the node so a light at the origin still casts shadows', async () => {
    // three's shadow camera sits AT the light's position, but Godot's
    // directional shadow ignores the node's position entirely. A light
    // authored at the origin — the default for a bare DirectionalLight3D —
    // therefore had every caster behind its own near plane and cast nothing.
    const renderer = await ReactThreeTestRenderer.create(
      <DirectionalLight3D
        node={{
          name: 'Sun',
          type: 'DirectionalLight3D',
          children: [],
          properties: {
            name: 'Sun',
            light_color: 'Color(1, 1, 1, 1)',
            light_energy: 1,
            shadow_enabled: true,
          },
        }}
      />
    );
    const light = renderer.scene.findByType('DirectionalLight').instance as THREE.DirectionalLight;
    // The reach comes from a NEGATIVE near plane, not from displacing the
    // light: everything anchored to the light's transform — its helper, the
    // selection box, F-to-frame — must stay at the node, as Godot draws them.
    expect(light.position.length()).toBe(0);
    expect(light.shadow.camera.near).toBeLessThan(0);
    expect(light.shadow.camera.far).toBeGreaterThan(0);
  });
});
