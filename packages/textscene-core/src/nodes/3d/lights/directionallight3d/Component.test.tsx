import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { DirectionalLight3D } from './Component';
import type { TscnNode } from '../../../../parser/types';
import type { DirectionalLight3DProperties } from './types';
import { LIGHT_INTENSITY_SCALE } from '../../../../r3f/lightConstants';
import { instanceAs } from '../../testing/reactThreeTestInstance';
import { readDirectionalShadowDeclaration } from '../../../../r3f/directionalShadow/declaration';
import { readSkyLightDeclaration } from '../../../../r3f/sky/skyLight';

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
      <DirectionalLight3D
        node={makeNode({
          transform: {
            basis_x: { x: 1, y: 0, z: 0 },
            basis_y: { x: 0, y: 1, z: 0 },
            basis_z: { x: 0, y: 0, z: 1 },
            origin: { x: 0, y: 10, z: 0 },
          },
        })}
      />
    );
    const group = renderer.scene.findByProps({ name: 'Sun' });
    expect(group.instance.position.y).toBe(10);
  });
});

describe('<DirectionalLight3D> shadow declaration', () => {
  it('declares the authored max distance, pancake size and fade start', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <DirectionalLight3D
        node={makeNode({
          shadow_enabled: true,
          directional_shadow_max_distance: 80,
          directional_shadow_pancake_size: 5,
          directional_shadow_fade_start: 0.5,
          shadow_normal_bias: 1.5,
        })}
      />
    );
    const light = instanceAs<THREE.DirectionalLight>(renderer.scene.findByType('DirectionalLight'));
    expect(readDirectionalShadowDeclaration(light)).toMatchObject({
      maxDistance: 80,
      pancakeSize: 5,
      fadeStart: 0.5,
      normalBias: 1.5,
    });
  });

  it('declares Godot’s defaults for an absent max distance, pancake size, fade start and normal bias', async () => {
    // `light_3d.cpp:600`, `:487`, `:601` and `:603`.
    const renderer = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={makeNode({ shadow_enabled: true })} />
    );
    const light = instanceAs<THREE.DirectionalLight>(renderer.scene.findByType('DirectionalLight'));
    expect(readDirectionalShadowDeclaration(light)).toMatchObject({
      maxDistance: 100,
      pancakeSize: 20,
      fadeStart: 0.8,
      normalBias: 2,
    });
  });

  it('declares a share of the shadow atlas for a shadowed light of the default sky mode', async () => {
    // `renderer_scene_cull.cpp:3268`, `light_3d.cpp:608`.
    const renderer = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={makeNode({ shadow_enabled: true })} />
    );
    const light = instanceAs<THREE.DirectionalLight>(renderer.scene.findByType('DirectionalLight'));
    expect(readDirectionalShadowDeclaration(light)?.sharesAtlas).toBe(true);
  });

  it('declares no share of the shadow atlas for a light that lights only the sky (edge case)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={makeNode({ shadow_enabled: true, sky_mode: 2 })} />
    );
    const light = instanceAs<THREE.DirectionalLight>(renderer.scene.findByType('DirectionalLight'));
    expect(readDirectionalShadowDeclaration(light)?.sharesAtlas).toBe(false);
  });

  it('declares no share of the shadow atlas for a light whose shadow is off (error case)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={makeNode({ shadow_enabled: false })} />
    );
    const light = instanceAs<THREE.DirectionalLight>(renderer.scene.findByType('DirectionalLight'));
    expect(readDirectionalShadowDeclaration(light)?.sharesAtlas).toBe(false);
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

describe('<DirectionalLight3D> shadow splits', () => {
  async function declared(overrides: Partial<DirectionalLight3DProperties>) {
    const renderer = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={makeNode({ shadow_enabled: true, ...overrides })} />
    );
    const light = instanceAs<THREE.DirectionalLight>(renderer.scene.findByType('DirectionalLight'));
    return { light, declaration: readDirectionalShadowDeclaration(light) };
  }

  it('declares Godot’s default four splits, offsets and no blending', async () => {
    // `light_3d.cpp:483-485`, `:606` and `:607`.
    const { declaration } = await declared({});
    expect(declaration).toMatchObject({
      splitCount: 4,
      splitOffsets: [0.1, 0.2, 0.5],
      blendSplits: false,
    });
  });

  it('declares the authored split offsets and blending', async () => {
    const { declaration } = await declared({
      directional_shadow_mode: 1,
      directional_shadow_split_1: 0.3,
      directional_shadow_split_2: 0.4,
      directional_shadow_split_3: 0.9,
      directional_shadow_blend_splits: true,
    });
    expect(declaration).toMatchObject({
      splitCount: 2,
      splitOffsets: [0.3, 0.4, 0.9],
      blendSplits: true,
    });
  });

  it('declares one split for the orthogonal mode (edge case)', async () => {
    const { light, declaration } = await declared({ directional_shadow_mode: 0 });
    expect(declaration?.splitCount).toBe(1);
    expect(light.castShadow).toBe(true);
  });

  it('casts nothing for a mode Godot sets up no split for (error case)', async () => {
    const { light, declaration } = await declared({ directional_shadow_mode: 3 });
    expect(declaration?.splitCount).toBe(0);
    expect(light.castShadow).toBe(false);
  });
});

describe('<DirectionalLight3D> sky mode', () => {
  const renderLight = async (overrides: Partial<DirectionalLight3DProperties>) => {
    const renderer = await ReactThreeTestRenderer.create(<DirectionalLight3D node={makeNode(overrides)} />);
    return instanceAs<THREE.DirectionalLight>(renderer.scene.findByType('DirectionalLight'));
  };

  it('lights surfaces and draws in the sky by default', async () => {
    const light = await renderLight({ light_energy: 2 });
    expect(light.intensity).toBeCloseTo(2 * LIGHT_INTENSITY_SCALE);
    expect(readSkyLightDeclaration(light)).toEqual({ drawsInSky: true, energy: 2 });
  });

  it('lights no surface and casts no shadow when it lights only the sky (edge case)', async () => {
    // Godot skips it for surfaces (`light_storage.cpp:632`) and shadows (`renderer_scene_cull.cpp:3268`).
    const light = await renderLight({ light_energy: 2, shadow_enabled: true, sky_mode: 2 });
    expect(light.intensity).toBe(0);
    expect(light.castShadow).toBe(false);
    expect(readSkyLightDeclaration(light)).toEqual({ drawsInSky: true, energy: 2 });
  });

  it('draws nothing in the sky when it lights only surfaces', async () => {
    // `sky.cpp:1069`.
    const light = await renderLight({ light_energy: 2, shadow_enabled: true, sky_mode: 1 });
    expect(light.intensity).toBeCloseTo(2 * LIGHT_INTENSITY_SCALE);
    expect(light.castShadow).toBe(true);
    expect(readSkyLightDeclaration(light)?.drawsInSky).toBe(false);
  });

  it('keeps the shadow declaration beside the sky declaration', async () => {
    const light = await renderLight({ shadow_enabled: true });
    expect(readDirectionalShadowDeclaration(light)).not.toBeNull();
    expect(readSkyLightDeclaration(light)).not.toBeNull();
  });

  it('lights surfaces and the sky for an unknown sky mode (error case)', async () => {
    const light = await renderLight({ light_energy: 1, sky_mode: 7 });
    expect(light.intensity).toBeCloseTo(LIGHT_INTENSITY_SCALE);
    expect(readSkyLightDeclaration(light)?.drawsInSky).toBe(true);
  });
});
