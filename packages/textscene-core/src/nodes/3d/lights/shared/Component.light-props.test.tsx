/** Property mapping of the DirectionalLight3D, OmniLight3D and SpotLight3D components. */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { DirectionalLight3D } from '../directionallight3d/Component';
import { OmniLight3D } from '../omnilight3d/Component';
import { SpotLight3D } from '../spotlight3d/Component';
import { LIGHT_INTENSITY_SCALE } from '../../../../r3f/lightConstants';
import type { TscnNode } from '../../../../parser/types';
import type { DirectionalLight3DProperties } from '../directionallight3d/types';
import type { OmniLight3DProperties } from '../omnilight3d/types';
import type { SpotLight3DProperties } from '../spotlight3d/types';
import { instanceAs } from '../../testing/reactThreeTestInstance';
import { readFogLightDeclaration } from '../../../../r3f/fog/fogLightDeclaration';
import { readSkyLightDeclaration } from '../../../../r3f/sky/skyLight';
import { fireSceneRenderFrom } from '../../../../r3f/testing/fireSceneRender';
import { visualLayersOf } from '../../../../r3f/visualLayers';

function dirNode(overrides: Partial<DirectionalLight3DProperties> = {}): TscnNode {
  const props: DirectionalLight3DProperties = {
    name: 'Sun',
    light_color: 'Color(1, 0.95, 0.9, 1)',
    layers: 1,
    light_energy: 1,
    shadow_enabled: false,
    ...overrides,
  };
  return {
    rawProperties: {},
    name: props.name ?? 'Sun',
    type: 'DirectionalLight3D',
    children: [],
    properties: props,
  };
}

function omniNode(overrides: Partial<OmniLight3DProperties> = {}): TscnNode {
  const props: OmniLight3DProperties = {
    name: 'Lamp',
    light_color: 'Color(1, 1, 1, 1)',
    layers: 1,
    light_energy: 1,
    shadow_enabled: false,
    omni_range: 5,
    omni_attenuation: 2,
    ...overrides,
  };
  return {
    rawProperties: {},
    name: props.name ?? 'Lamp',
    type: 'OmniLight3D',
    children: [],
    properties: props,
  };
}

function spotNode(overrides: Partial<SpotLight3DProperties> = {}): TscnNode {
  const props: SpotLight3DProperties = {
    name: 'Torch',
    light_color: 'Color(1, 1, 1, 1)',
    layers: 1,
    light_energy: 1,
    shadow_enabled: false,
    spot_range: 10,
    spot_angle: 30,
    spot_attenuation: 1.0,
    spot_angle_attenuation: 1.0,
    ...overrides,
  };
  return {
    rawProperties: {},
    name: props.name ?? 'Torch',
    type: 'SpotLight3D',
    children: [],
    properties: props,
  };
}

describe('Lights — properties (assertions 67–80)', () => {
  it('#67 DirectionalLight3D.light_color → DirectionalLight.color', async () => {
    const r = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={dirNode({ light_color: 'Color(1, 0, 0, 1)' })} />
    );
    const l = r.scene.findByType('DirectionalLight');
    expect(instanceAs<THREE.DirectionalLight>(l).color.getHex()).toBe(0xff0000);
  });

  it('#68 DirectionalLight3D.light_energy → DirectionalLight.intensity (scaled)', async () => {
    const r = await ReactThreeTestRenderer.create(<DirectionalLight3D node={dirNode({ light_energy: 2 })} />);
    const l = r.scene.findByType('DirectionalLight');
    expect(instanceAs<THREE.DirectionalLight>(l).intensity).toBe(2 * LIGHT_INTENSITY_SCALE);
  });

  it('#69 DirectionalLight3D.shadow_enabled=true → castShadow=true', async () => {
    const r = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={dirNode({ shadow_enabled: true })} />
    );
    expect(instanceAs<THREE.DirectionalLight>(r.scene.findByType('DirectionalLight')).castShadow).toBe(true);
  });

  it('#70 DirectionalLight3D.shadow_enabled=false → castShadow=false', async () => {
    const r = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={dirNode({ shadow_enabled: false })} />
    );
    expect(instanceAs<THREE.DirectionalLight>(r.scene.findByType('DirectionalLight')).castShadow).toBe(false);
  });

  it('#71 OmniLight3D.light_color → PointLight.color', async () => {
    const r = await ReactThreeTestRenderer.create(
      <OmniLight3D node={omniNode({ light_color: 'Color(0, 1, 0, 1)' })} />
    );
    const l = r.scene.findByType('PointLight');
    expect(instanceAs<THREE.PointLight>(l).color.getHex()).toBe(0x00ff00);
  });

  it('#72 OmniLight3D.light_energy → PointLight.intensity (scaled)', async () => {
    const r = await ReactThreeTestRenderer.create(<OmniLight3D node={omniNode({ light_energy: 1.5 })} />);
    expect(instanceAs<THREE.PointLight>(r.scene.findByType('PointLight')).intensity).toBe(
      1.5 * LIGHT_INTENSITY_SCALE
    );
  });

  it('#73 OmniLight3D.omni_range → PointLight.distance', async () => {
    const r = await ReactThreeTestRenderer.create(<OmniLight3D node={omniNode({ omni_range: 12 })} />);
    expect(instanceAs<THREE.PointLight>(r.scene.findByType('PointLight')).distance).toBe(12);
  });

  it('#74 OmniLight3D.shadow_enabled → light.castShadow', async () => {
    const r = await ReactThreeTestRenderer.create(<OmniLight3D node={omniNode({ shadow_enabled: true })} />);
    expect(instanceAs<THREE.PointLight>(r.scene.findByType('PointLight')).castShadow).toBe(true);
  });

  it('#75 SpotLight3D.light_color → SpotLight.color', async () => {
    const r = await ReactThreeTestRenderer.create(
      <SpotLight3D node={spotNode({ light_color: 'Color(0, 0, 1, 1)' })} />
    );
    expect(instanceAs<THREE.SpotLight>(r.scene.findByType('SpotLight')).color.getHex()).toBe(0x0000ff);
  });

  it('#76 SpotLight3D.light_energy → SpotLight.intensity (scaled)', async () => {
    const r = await ReactThreeTestRenderer.create(<SpotLight3D node={spotNode({ light_energy: 3 })} />);
    expect(instanceAs<THREE.SpotLight>(r.scene.findByType('SpotLight')).intensity).toBe(
      3 * LIGHT_INTENSITY_SCALE
    );
  });

  it('#77 SpotLight3D.spot_range → SpotLight.distance', async () => {
    const r = await ReactThreeTestRenderer.create(<SpotLight3D node={spotNode({ spot_range: 25 })} />);
    expect(instanceAs<THREE.SpotLight>(r.scene.findByType('SpotLight')).distance).toBe(25);
  });

  it('#78 SpotLight3D.spot_angle (degrees) → SpotLight.angle (radians)', async () => {
    const r = await ReactThreeTestRenderer.create(<SpotLight3D node={spotNode({ spot_angle: 90 })} />);
    expect(instanceAs<THREE.SpotLight>(r.scene.findByType('SpotLight')).angle).toBeCloseTo(Math.PI / 2, 5);
  });

  it('#79 SpotLight3D.spot_attenuation → SpotLight.decay (distance falloff)', async () => {
    // Godot's spot_attenuation is the distance falloff exponent, so it maps to
    // three.js decay. spot_angle_attenuation maps to penumbra.
    const r = await ReactThreeTestRenderer.create(
      <SpotLight3D
        node={{
          rawProperties: {},
          name: 'T',
          type: 'SpotLight3D',
          children: [],
          properties: {
            ...spotNode().properties,
            ...({ spot_attenuation: 0.5 } as Record<string, unknown>),
          },
        }}
      />
    );
    expect(instanceAs<THREE.SpotLight>(r.scene.findByType('SpotLight')).decay).toBe(0.5);
  });

  it('#80 SpotLight3D.shadow_enabled → light.castShadow', async () => {
    const r = await ReactThreeTestRenderer.create(<SpotLight3D node={spotNode({ shadow_enabled: true })} />);
    expect(instanceAs<THREE.SpotLight>(r.scene.findByType('SpotLight')).castShadow).toBe(true);
  });
});

describe('Lights — volumetric fog declaration', () => {
  it("declares Godot's default fog energy of 1 when the light sets none", async () => {
    const r = await ReactThreeTestRenderer.create(<OmniLight3D node={omniNode()} />);
    expect(readFogLightDeclaration(instanceAs<THREE.PointLight>(r.scene.findByType('PointLight')))).toEqual({
      energy: 1,
    });
  });

  it('declares light_volumetric_fog_energy on a DirectionalLight3D', async () => {
    const r = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={dirNode({ light_volumetric_fog_energy: 3 })} />
    );
    const sun = instanceAs<THREE.DirectionalLight>(r.scene.findByType('DirectionalLight'));
    expect(readFogLightDeclaration(sun)).toEqual({ energy: 3 });
  });

  it('declares the cone exponent input of a SpotLight3D', async () => {
    const r = await ReactThreeTestRenderer.create(
      <SpotLight3D node={spotNode({ light_volumetric_fog_energy: 0.5, spot_angle_attenuation: 2 })} />
    );
    const spot = instanceAs<THREE.SpotLight>(r.scene.findByType('SpotLight'));
    expect(readFogLightDeclaration(spot)).toEqual({ energy: 0.5, spotAngleAttenuation: 2 });
  });
});

describe('Lights: sign, shadow opacity and distance fade', () => {
  it('subtracts a light_negative OmniLight3D through a negative intensity', async () => {
    const r = await ReactThreeTestRenderer.create(
      <OmniLight3D node={omniNode({ light_energy: 2, light_negative: true })} />
    );
    const lamp = instanceAs<THREE.PointLight>(r.scene.findByType('PointLight'));
    expect(lamp.intensity).toBeCloseTo(-2 * LIGHT_INTENSITY_SCALE, 6);
  });

  it('gives the sky the negative energy of a light_negative DirectionalLight3D', async () => {
    const r = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={dirNode({ light_energy: 2, light_negative: true })} />
    );
    const sun = instanceAs<THREE.DirectionalLight>(r.scene.findByType('DirectionalLight'));
    expect(readSkyLightDeclaration(sun)?.energy).toBe(-2);
  });

  it('maps shadow_opacity onto shadow.intensity, defaulting to 1', async () => {
    const r = await ReactThreeTestRenderer.create(
      <>
        <SpotLight3D node={spotNode({ shadow_opacity: 0.4 })} />
        <OmniLight3D node={omniNode()} />
      </>
    );
    expect(instanceAs<THREE.SpotLight>(r.scene.findByType('SpotLight')).shadow.intensity).toBe(0.4);
    expect(instanceAs<THREE.PointLight>(r.scene.findByType('PointLight')).shadow.intensity).toBe(1);
  });

  it('fades an OmniLight3D and its shadow by the distance to the rendering camera', async () => {
    const r = await ReactThreeTestRenderer.create(
      <OmniLight3D
        node={omniNode({
          distance_fade_enabled: true,
          distance_fade_begin: 10,
          distance_fade_shadow: 6,
          distance_fade_length: 4,
        })}
      />
    );
    const lamp = instanceAs<THREE.PointLight>(r.scene.findByType('PointLight'));

    fireSceneRenderFrom(r.scene.instance as THREE.Scene, 12);
    // smoothstep(0, 1, 1 - (12 - 10) / 4) is 0.5, and the shadow is past 6 + 4.
    expect(lamp.intensity).toBeCloseTo(0.5 * LIGHT_INTENSITY_SCALE, 6);
    expect(lamp.shadow.intensity).toBe(0);
  });

  it('leaves a light whole while distance_fade_enabled is off', async () => {
    const r = await ReactThreeTestRenderer.create(
      <SpotLight3D node={spotNode({ distance_fade_begin: 1, distance_fade_length: 1 })} />
    );
    const spot = instanceAs<THREE.SpotLight>(r.scene.findByType('SpotLight'));

    fireSceneRenderFrom(r.scene.instance as THREE.Scene, 50);
    expect(spot.intensity).toBeCloseTo(LIGHT_INTENSITY_SCALE, 6);
  });

  it('restores the unfaded light when the fade turns off (edge case)', async () => {
    const faded = omniNode({ distance_fade_enabled: true, distance_fade_begin: 1, distance_fade_length: 1 });
    const r = await ReactThreeTestRenderer.create(<OmniLight3D node={faded} />);
    fireSceneRenderFrom(r.scene.instance as THREE.Scene, 50);

    await r.update(<OmniLight3D node={omniNode()} />);
    expect(instanceAs<THREE.PointLight>(r.scene.findByType('PointLight')).intensity).toBeCloseTo(
      LIGHT_INTENSITY_SCALE,
      6
    );
  });
});

describe('Lights: render layers, which a ReflectionProbe cull_mask tests', () => {
  it("carries a DirectionalLight3D's layers", async () => {
    const r = await ReactThreeTestRenderer.create(<DirectionalLight3D node={dirNode({ layers: 2 })} />);
    expect(visualLayersOf(r.scene.findByType('DirectionalLight').instance)).toBe(2);
  });

  it("carries an OmniLight3D's layers", async () => {
    const r = await ReactThreeTestRenderer.create(<OmniLight3D node={omniNode({ layers: 4 })} />);
    expect(visualLayersOf(r.scene.findByType('PointLight').instance)).toBe(4);
  });

  it("carries a SpotLight3D's layers", async () => {
    const r = await ReactThreeTestRenderer.create(<SpotLight3D node={spotNode({ layers: 8 })} />);
    expect(visualLayersOf(r.scene.findByType('SpotLight').instance)).toBe(8);
  });

  it('carries a layers mask of 0, which no cull_mask matches (edge case)', async () => {
    const r = await ReactThreeTestRenderer.create(<OmniLight3D node={omniNode({ layers: 0 })} />);
    expect(visualLayersOf(r.scene.findByType('PointLight').instance)).toBe(0);
  });
});
