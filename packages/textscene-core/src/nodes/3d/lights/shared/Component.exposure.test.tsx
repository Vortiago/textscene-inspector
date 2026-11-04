/**
 * Each Light3D holds its authored energy, and a render of its world scales it by the exposure
 * factor, as Godot multiplies a light's energy by the factor when it fills the light buffer for a
 * render (`light_storage.cpp:656-658`, `:884-886`).
 */

import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { createPortal } from '@react-three/fiber';
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
import { fireSceneRender, fireSceneRenderEnd } from '../../../../r3f/testing/fireSceneRender';
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
    attributes: { exposureMultiplier: multiplier, autoExposure: null },
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

const CAMERA = new THREE.PerspectiveCamera();

/** What the light of `type` holds outside a render, and in a render of its world. */
async function intensitiesOf(type: string, multiplier: number | null, element: ReactNode) {
  const renderer = await ReactThreeTestRenderer.create(inWorld(multiplier, element));
  const scene = renderer.scene.instance as THREE.Scene;
  const light = instanceAs<THREE.Light>(renderer.scene.findByType(type));
  const held = light.intensity;
  fireSceneRender(scene, CAMERA);
  const drawn = light.intensity;
  fireSceneRenderEnd(scene, CAMERA);
  return { held, drawn };
}

/** Expects `light` to hold `energy` and to draw at `energy` times `factor`. */
function expectExposed(light: { held: number; drawn: number }, energy: number, factor: number) {
  expect(light.held).toBeCloseTo(energy * LIGHT_INTENSITY_SCALE, 10);
  expect(light.drawn).toBeCloseTo(energy * LIGHT_INTENSITY_SCALE * factor, 10);
}

describe('Light3D energy under an exposure', () => {
  it('holds the energy of a DirectionalLight3D, and draws it at the exposure', async () => {
    const lightNode = directional({ light_energy: 0.5 });
    expectExposed(
      await intensitiesOf('DirectionalLight', 2, <DirectionalLight3D node={lightNode} />),
      0.5,
      2
    );
  });

  it('holds the energy of an OmniLight3D, and draws it at the exposure', async () => {
    const lightNode = omni({ light_energy: 1.5 });
    expectExposed(await intensitiesOf('PointLight', 3, <OmniLight3D node={lightNode} />), 1.5, 3);
  });

  it('holds the energy of a SpotLight3D, and draws it at the exposure', async () => {
    const lightNode = spot({ light_energy: 2 });
    expectExposed(await intensitiesOf('SpotLight', 0.25, <SpotLight3D node={lightNode} />), 2, 0.25);
  });

  it('holds the energy of an AreaLight3D, and draws it at the exposure', async () => {
    const lightNode = area({ light_energy: 1 });
    expectExposed(await intensitiesOf('RectAreaLight', 4, <AreaLight3D node={lightNode} />), 1, 4);
  });

  it('keeps a negative light subtracting', async () => {
    const lightNode = omni({ light_energy: 1, light_negative: true });
    expectExposed(await intensitiesOf('PointLight', 2, <OmniLight3D node={lightNode} />), -1, 2);
  });

  it('keeps a negative energy on a light that is not negative subtracting', async () => {
    const lightNode = omni({ light_energy: -1, light_negative: false });
    expectExposed(await intensitiesOf('PointLight', 2, <OmniLight3D node={lightNode} />), -1, 2);
  });

  it('draws no light under an exposure of 0, and holds its energy (edge case)', async () => {
    const lightNode = omni();
    expectExposed(await intensitiesOf('PointLight', 0, <OmniLight3D node={lightNode} />), 1, 0);
  });

  it('leaves a Sky Only light at zero intensity', async () => {
    const lightNode = directional({ sky_mode: 2 });
    expectExposed(await intensitiesOf('DirectionalLight', 8, <DirectionalLight3D node={lightNode} />), 0, 8);
  });

  it('draws a light at its energy in a world with no CameraAttributes', async () => {
    const lightNode = omni({ light_energy: 2 });
    expectExposed(await intensitiesOf('PointLight', null, <OmniLight3D node={lightNode} />), 2, 1);
  });

  it('draws a light at the exposure of the world it is in', async () => {
    const subScene = new THREE.Scene();
    const inner = createPortal(
      <WorldEnvironmentScope world="subViewport">
        <OmniLight3D node={omni()} />
      </WorldEnvironmentScope>,
      subScene
    );
    const renderer = await ReactThreeTestRenderer.create(inWorld(2, inner));
    const light = subScene.getObjectByProperty('isPointLight', true) as THREE.PointLight;
    fireSceneRender(subScene, CAMERA);
    expect(light.intensity).toBeCloseTo(LIGHT_INTENSITY_SCALE, 10);
    await renderer.unmount();
  });
});
