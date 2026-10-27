/**
 * The lights a GLB brings scale by the world's exposure as every Light3D does, and a directional one
 * tells the sky its energy before the scaling, so its disc scales once in `SkyLayer`.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { WorldEnvironmentScope } from '../../environment/WorldEnvironmentScope';
import { usePublishCameraAttributes } from '../../environment/worldExposure';
import { LIGHT_INTENSITY_SCALE } from '../../lightConstants';
import { skyLightEnergy } from '../../sky/skyLight';
import { useGlbLightExposure } from './useGlbLightExposure';

function Exposed({ object, multiplier }: { object: THREE.Object3D; multiplier: number | null }) {
  return multiplier === null ? (
    <Lit object={object} />
  ) : (
    <Published object={object} multiplier={multiplier} />
  );
}

function Published({ object, multiplier }: { object: THREE.Object3D; multiplier: number }) {
  usePublishCameraAttributes({ status: 'resolved', attributes: { exposureMultiplier: multiplier } });
  return <Lit object={object} />;
}

function Lit({ object }: { object: THREE.Object3D }) {
  useGlbLightExposure(object);
  return null;
}

function glbWithLights() {
  const root = new THREE.Group();
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  const lamp = new THREE.PointLight(0xffffff, 3);
  root.add(sun, lamp);
  return { root, sun, lamp };
}

function mount(object: THREE.Object3D, multiplier: number | null) {
  return ReactThreeTestRenderer.create(
    <WorldEnvironmentScope world="root">
      <Exposed object={object} multiplier={multiplier} />
    </WorldEnvironmentScope>
  );
}

describe('useGlbLightExposure', () => {
  it('scales the intensity of each light by the exposure factor', async () => {
    const { root, sun, lamp } = glbWithLights();
    await mount(root, 2);
    expect([sun.intensity, lamp.intensity]).toEqual([1.6, 6]);
  });

  it('leaves the lights alone without camera attributes', async () => {
    const { root, sun, lamp } = glbWithLights();
    await mount(root, null);
    expect([sun.intensity, lamp.intensity]).toEqual([0.8, 3]);
  });

  it('puts the intensities back when the world unmounts', async () => {
    const { root, sun, lamp } = glbWithLights();
    const renderer = await mount(root, 2);
    await renderer.unmount();
    expect([sun.intensity, lamp.intensity]).toEqual([0.8, 3]);
  });

  it('scales a light by 0 under an exposure of 0 (edge case)', async () => {
    const { root, sun } = glbWithLights();
    await mount(root, 0);
    expect(sun.intensity).toBe(0);
  });

  it('tells the sky the energy of a directional light before the scaling', async () => {
    const { root, sun } = glbWithLights();
    await mount(root, 2);
    expect(skyLightEnergy(sun)).toBeCloseTo(0.8 / LIGHT_INTENSITY_SCALE, 12);
  });

  it('leaves no sky declaration on a light once the world unmounts', async () => {
    const { root, sun } = glbWithLights();
    const renderer = await mount(root, 2);
    await renderer.unmount();
    expect(sun.userData).toEqual({});
  });
});
