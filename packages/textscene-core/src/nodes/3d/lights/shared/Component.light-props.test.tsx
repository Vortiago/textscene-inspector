/**
 * Strict-verification harness (group H) — 14 assertions covering
 * the three light components (DirectionalLight3D, OmniLight3D, SpotLight3D).
 *
 * Assertions: 67–80 of `docs/archive/STRICT-VERIFICATION.md`.
 */

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

function dirNode(overrides: Partial<DirectionalLight3DProperties> = {}): TscnNode {
  const props: DirectionalLight3DProperties = {
    name: 'Sun',
    light_color: 'Color(1, 0.95, 0.9, 1)',
    light_energy: 1,
    shadow_enabled: false,
    ...overrides,
  };
  return { name: props.name ?? 'Sun', type: 'DirectionalLight3D', children: [], properties: props };
}

function omniNode(overrides: Partial<OmniLight3DProperties> = {}): TscnNode {
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

function spotNode(overrides: Partial<SpotLight3DProperties> = {}): TscnNode {
  const props: SpotLight3DProperties = {
    name: 'Torch',
    light_color: 'Color(1, 1, 1, 1)',
    light_energy: 1,
    shadow_enabled: false,
    spot_range: 10,
    spot_angle: 30,
    spot_attenuation: 1,
    spot_angle_attenuation: 1,
    ...overrides,
  };
  return { name: props.name ?? 'Torch', type: 'SpotLight3D', children: [], properties: props };
}

describe('Lights — properties (assertions 67–80)', () => {
  it('#67 DirectionalLight3D.light_color → DirectionalLight.color', async () => {
    const r = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={dirNode({ light_color: 'Color(1, 0, 0, 1)' })} />
    );
    const l = r.scene.findByType('DirectionalLight');
    expect((l.instance as THREE.DirectionalLight).color.getHex()).toBe(0xff0000);
  });

  it('#68 DirectionalLight3D.light_energy → DirectionalLight.intensity (scaled)', async () => {
    const r = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={dirNode({ light_energy: 2 })} />
    );
    const l = r.scene.findByType('DirectionalLight');
    expect((l.instance as THREE.DirectionalLight).intensity).toBe(2 * LIGHT_INTENSITY_SCALE);
  });

  it('#69 DirectionalLight3D.shadow_enabled=true → castShadow=true', async () => {
    const r = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={dirNode({ shadow_enabled: true })} />
    );
    expect((r.scene.findByType('DirectionalLight').instance as THREE.DirectionalLight).castShadow).toBe(true);
  });

  it('#70 DirectionalLight3D.shadow_enabled=false → castShadow=false', async () => {
    const r = await ReactThreeTestRenderer.create(
      <DirectionalLight3D node={dirNode({ shadow_enabled: false })} />
    );
    expect((r.scene.findByType('DirectionalLight').instance as THREE.DirectionalLight).castShadow).toBe(false);
  });

  it('#71 OmniLight3D.light_color → PointLight.color', async () => {
    const r = await ReactThreeTestRenderer.create(
      <OmniLight3D node={omniNode({ light_color: 'Color(0, 1, 0, 1)' })} />
    );
    const l = r.scene.findByType('PointLight');
    expect((l.instance as THREE.PointLight).color.getHex()).toBe(0x00ff00);
  });

  it('#72 OmniLight3D.light_energy → PointLight.intensity (scaled)', async () => {
    const r = await ReactThreeTestRenderer.create(
      <OmniLight3D node={omniNode({ light_energy: 1.5 })} />
    );
    expect((r.scene.findByType('PointLight').instance as THREE.PointLight).intensity).toBe(
      1.5 * LIGHT_INTENSITY_SCALE
    );
  });

  it('#73 OmniLight3D.omni_range → PointLight.distance', async () => {
    const r = await ReactThreeTestRenderer.create(
      <OmniLight3D node={omniNode({ omni_range: 12 })} />
    );
    expect((r.scene.findByType('PointLight').instance as THREE.PointLight).distance).toBe(12);
  });

  it('#74 OmniLight3D.shadow_enabled → light.castShadow', async () => {
    const r = await ReactThreeTestRenderer.create(
      <OmniLight3D node={omniNode({ shadow_enabled: true })} />
    );
    expect((r.scene.findByType('PointLight').instance as THREE.PointLight).castShadow).toBe(true);
  });

  it('#75 SpotLight3D.light_color → SpotLight.color', async () => {
    const r = await ReactThreeTestRenderer.create(
      <SpotLight3D node={spotNode({ light_color: 'Color(0, 0, 1, 1)' })} />
    );
    expect((r.scene.findByType('SpotLight').instance as THREE.SpotLight).color.getHex()).toBe(0x0000ff);
  });

  it('#76 SpotLight3D.light_energy → SpotLight.intensity (scaled)', async () => {
    const r = await ReactThreeTestRenderer.create(
      <SpotLight3D node={spotNode({ light_energy: 3 })} />
    );
    expect((r.scene.findByType('SpotLight').instance as THREE.SpotLight).intensity).toBe(
      3 * LIGHT_INTENSITY_SCALE
    );
  });

  it('#77 SpotLight3D.spot_range → SpotLight.distance', async () => {
    const r = await ReactThreeTestRenderer.create(
      <SpotLight3D node={spotNode({ spot_range: 25 })} />
    );
    expect((r.scene.findByType('SpotLight').instance as THREE.SpotLight).distance).toBe(25);
  });

  it('#78 SpotLight3D.spot_angle (degrees) → SpotLight.angle (radians)', async () => {
    const r = await ReactThreeTestRenderer.create(
      <SpotLight3D node={spotNode({ spot_angle: 90 })} />
    );
    expect((r.scene.findByType('SpotLight').instance as THREE.SpotLight).angle).toBeCloseTo(
      Math.PI / 2,
      5
    );
  });

  it('#79 SpotLight3D.spot_attenuation → SpotLight.decay (distance falloff)', async () => {
    // Godot's spot_attenuation is the DISTANCE falloff exponent → three.js decay
    // (cone-edge softness comes from spot_angle_attenuation → penumbra instead).
    const r = await ReactThreeTestRenderer.create(
      <SpotLight3D
        node={{
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
    expect((r.scene.findByType('SpotLight').instance as THREE.SpotLight).decay).toBe(0.5);
  });

  it('#80 SpotLight3D.shadow_enabled → light.castShadow', async () => {
    const r = await ReactThreeTestRenderer.create(
      <SpotLight3D node={spotNode({ shadow_enabled: true })} />
    );
    expect((r.scene.findByType('SpotLight').instance as THREE.SpotLight).castShadow).toBe(true);
  });
});
