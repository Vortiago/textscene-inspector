/**
 * A world's exposure scales the energy of every Light3D that draws in it, as Godot multiplies a
 * light's energy by the exposure factor when it fills the light buffer
 * (`light_storage.cpp:656-658`, `:884-886`).
 */

import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { DirectionalLight3D } from '../directionallight3d/Component';
import { OmniLight3D } from '../omnilight3d/Component';
import { SpotLight3D } from '../spotlight3d/Component';
import { AreaLight3D } from '../arealight3d/Component';
import { LIGHT_INTENSITY_SCALE } from '../../../../r3f/lightConstants';
import { WorldEnvironmentScope } from '../../../../r3f/environment/WorldEnvironmentScope';
import {
  usePublishCameraAttributes,
  type CameraAttributesResolution,
} from '../../../../r3f/environment/worldExposure';
import type { TscnNode } from '../../../../parser/types';
import { instanceAs } from '../../testing/reactThreeTestInstance';
import { LIGHT_3D_DEFAULTS } from '../../../../godot/scene/light';

function node(type: string, properties: Record<string, unknown>): TscnNode {
  const base = {
    name: type,
    layers: 1,
    light_color: 'Color(1, 1, 1, 1)',
    light_energy: 1,
    light_bake_mode: LIGHT_3D_DEFAULTS.bakeMode,
    shadow_enabled: false,
  };
  return {
    rawProperties: {},
    name: type,
    type,
    children: [],
    properties: { ...base, ...properties } as TscnNode['properties'],
  };
}

const directional = (properties: Record<string, unknown> = {}) => node('DirectionalLight3D', properties);
const omni = (properties: Record<string, unknown> = {}) =>
  node('OmniLight3D', { omni_range: 5, omni_attenuation: 2, ...properties });
const spot = (properties: Record<string, unknown> = {}) =>
  node('SpotLight3D', {
    spot_range: 10,
    spot_angle: 30,
    spot_attenuation: 1,
    spot_angle_attenuation: 1,
    ...properties,
  });
const area = (properties: Record<string, unknown> = {}) =>
  node('AreaLight3D', {
    area_range: 5,
    area_attenuation: 1,
    area_size: { x: 1, y: 1 },
    area_normalize_energy: false,
    light_size: 0.5,
    ...properties,
  });

function Exposure({ multiplier }: { multiplier: number }) {
  const resolution: CameraAttributesResolution = {
    status: 'resolved',
    attributes: { exposureMultiplier: multiplier },
  };
  usePublishCameraAttributes(resolution);
  return null;
}

function inWorld(multiplier: number | null, children: ReactNode) {
  return (
    <WorldEnvironmentScope world="subViewport">
      {multiplier !== null && <Exposure multiplier={multiplier} />}
      {children}
    </WorldEnvironmentScope>
  );
}

async function intensityOf(type: string, multiplier: number | null, element: ReactNode) {
  const renderer = await ReactThreeTestRenderer.create(inWorld(multiplier, element));
  return instanceAs<THREE.Light>(renderer.scene.findByType(type)).intensity;
}

describe('Light3D energy under an exposure', () => {
  it('scales a DirectionalLight3D', async () => {
    const lightNode = directional({ light_energy: 0.5 });
    expect(await intensityOf('DirectionalLight', 2, <DirectionalLight3D node={lightNode} />)).toBeCloseTo(
      0.5 * LIGHT_INTENSITY_SCALE * 2,
      10
    );
  });

  it('scales an OmniLight3D', async () => {
    const lightNode = omni({ light_energy: 1.5 });
    expect(await intensityOf('PointLight', 3, <OmniLight3D node={lightNode} />)).toBeCloseTo(
      1.5 * LIGHT_INTENSITY_SCALE * 3,
      10
    );
  });

  it('scales a SpotLight3D', async () => {
    const lightNode = spot({ light_energy: 2 });
    expect(await intensityOf('SpotLight', 0.25, <SpotLight3D node={lightNode} />)).toBeCloseTo(
      2 * LIGHT_INTENSITY_SCALE * 0.25,
      10
    );
  });

  it('scales an AreaLight3D', async () => {
    const lightNode = area({ light_energy: 1 });
    expect(await intensityOf('RectAreaLight', 4, <AreaLight3D node={lightNode} />)).toBeCloseTo(
      LIGHT_INTENSITY_SCALE * 4,
      10
    );
  });

  it('keeps a negative light subtracting', async () => {
    const lightNode = omni({ light_energy: 1, light_negative: true });
    expect(await intensityOf('PointLight', 2, <OmniLight3D node={lightNode} />)).toBeCloseTo(
      -LIGHT_INTENSITY_SCALE * 2,
      10
    );
  });

  it('keeps a negative energy on a light that is not negative subtracting', async () => {
    const lightNode = omni({ light_energy: -1, light_negative: false });
    expect(await intensityOf('PointLight', 2, <OmniLight3D node={lightNode} />)).toBeCloseTo(
      -LIGHT_INTENSITY_SCALE * 2,
      10
    );
  });

  it('darkens a light under an exposure of 0 (edge case)', async () => {
    const lightNode = omni();
    expect(await intensityOf('PointLight', 0, <OmniLight3D node={lightNode} />)).toBe(0);
  });

  it('leaves a Sky Only light at zero intensity', async () => {
    const lightNode = directional({ sky_mode: 2 });
    expect(await intensityOf('DirectionalLight', 8, <DirectionalLight3D node={lightNode} />)).toBe(0);
  });

  it('leaves a light unscaled in a world with no CameraAttributes', async () => {
    const lightNode = omni({ light_energy: 2 });
    expect(await intensityOf('PointLight', null, <OmniLight3D node={lightNode} />)).toBeCloseTo(
      2 * LIGHT_INTENSITY_SCALE,
      10
    );
  });

  it('reads the exposure of the world the light is in', async () => {
    const lightNode = omni();
    const renderer = await ReactThreeTestRenderer.create(
      inWorld(
        2,
        <WorldEnvironmentScope world="subViewport">
          <OmniLight3D node={lightNode} />
        </WorldEnvironmentScope>
      )
    );
    expect(instanceAs<THREE.PointLight>(renderer.scene.findByType('PointLight')).intensity).toBeCloseTo(
      LIGHT_INTENSITY_SCALE,
      10
    );
  });
});
