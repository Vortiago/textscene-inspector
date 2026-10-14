import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { AreaLight3D } from './Component';
import type { TscnNode } from '../../../../parser/types';
import type { AreaLight3DProperties } from './types';
import { LIGHT_INTENSITY_SCALE } from '../../../../r3f/lightConstants';
import { instanceAs } from '../../testing/reactThreeTestInstance';
import * as THREE from 'three';
import { areaLightUserData } from '../../../../r3f/areaLight/areaLightFalloff';
import { fireSceneRenderFrom } from '../../../../r3f/testing/fireSceneRender';
import { readFogLightDeclaration } from '../../../../r3f/fog/fogLightDeclaration';
import { AtlasAreaShadow, type AreaShadowLight } from '../../../../r3f/positionalShadow/atlasAreaShadow';
import { readPositionalShadowDeclaration } from '../../../../r3f/positionalShadow/declaration';

function makeNode(overrides: Partial<AreaLight3DProperties> = {}): TscnNode {
  const props: AreaLight3DProperties = {
    name: 'Area',
    light_color: 'Color(1, 1, 1, 1)',
    light_energy: 1,
    light_specular: 1,
    light_size: 0.5,
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

function areaShadowOf(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>): AtlasAreaShadow {
  return instanceAs<AreaShadowLight>(renderer.scene.findByType('RectAreaLight')).shadow;
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

  it('casts its shadow while shadow_enabled is on', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D node={makeNode({ shadow_enabled: true })} />
    );
    const light = instanceAs<THREE.RectAreaLight>(renderer.scene.findByType('RectAreaLight'));
    expect(light.castShadow).toBe(true);
    expect((light as { shadow?: unknown }).shadow).toBeInstanceOf(AtlasAreaShadow);
  });

  it('casts nothing while shadow_enabled is off (edge case)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<AreaLight3D node={makeNode()} />);
    expect(instanceAs<THREE.RectAreaLight>(renderer.scene.findByType('RectAreaLight')).castShadow).toBe(
      false
    );
  });

  it('gives its shadow the range, the size, the bias, the opacity and the penumbra', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D
        node={makeNode({
          shadow_enabled: true,
          area_range: 6,
          area_size: { x: 2, y: 1 },
          shadow_bias: 0.3,
          shadow_opacity: 0.6,
          light_size: 0.25,
        })}
      />
    );
    const shadow = areaShadowOf(renderer);
    expect([shadow.range, shadow.size.x, shadow.size.y, shadow.bias]).toEqual([6, 2, 1, 0.3]);
    expect(shadow.opacity).toBe(0.6);
  });

  it("takes AreaLight3D's own shadow bias, 0.1, when the scene sets none", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D node={makeNode({ shadow_enabled: true })} />
    );
    expect(areaShadowOf(renderer).bias).toBe(0.1);
  });

  it('declares its shadow to the fitter, a penumbra of its size times the blur alone', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D node={makeNode({ shadow_enabled: true, shadow_blur: 1.5, shadow_normal_bias: 2 })} />
    );
    const light = instanceAs<THREE.RectAreaLight>(renderer.scene.findByType('RectAreaLight'));
    expect(readPositionalShadowDeclaration(light)).toEqual({ normalBias: 2, softShadowRadius: -0.75 });
  });

  it('filters a light without a size at the blur times the quality radius (edge case)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D node={makeNode({ shadow_enabled: true, light_size: 0 })} />
    );
    const light = instanceAs<THREE.RectAreaLight>(renderer.scene.findByType('RectAreaLight'));
    expect(readPositionalShadowDeclaration(light)?.softShadowRadius).toBe(2);
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

  it('fades the light and its shadow by the distance to the rendering camera', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D
        node={makeNode({
          shadow_enabled: true,
          distance_fade_enabled: true,
          distance_fade_begin: 10,
          distance_fade_shadow: 6,
          distance_fade_length: 4,
        })}
      />
    );
    fireSceneRenderFrom(renderer.scene.instance as THREE.Scene, 12);
    const light = instanceAs<THREE.RectAreaLight>(renderer.scene.findByType('RectAreaLight'));
    // smoothstep(0, 1, 1 - (12 - 10) / 4) is 0.5, and the shadow is past 6 + 4.
    expect(light.intensity).toBeCloseTo(0.5 * LIGHT_INTENSITY_SCALE, 6);
    expect(areaShadowOf(renderer).opacity).toBe(0);
  });

  it('subtracts light when light_negative is on', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D node={makeNode({ light_energy: 2.0, light_negative: true })} />
    );
    const light = renderer.scene.findByType('RectAreaLight');
    expect(instanceAs<THREE.RectAreaLight>(light).intensity).toBe(-2.0 * LIGHT_INTENSITY_SCALE);
  });

  it('draws nothing past the end of the fade (edge case)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AreaLight3D
        node={makeNode({ distance_fade_enabled: true, distance_fade_begin: 1, distance_fade_length: 1 })}
      />
    );
    const light = instanceAs<THREE.RectAreaLight>(renderer.scene.findByType('RectAreaLight'));

    fireSceneRenderFrom(renderer.scene.instance as THREE.Scene, 50);
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
