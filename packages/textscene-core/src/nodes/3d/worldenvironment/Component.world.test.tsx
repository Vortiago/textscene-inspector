/** WorldEnvironment background, ambient lighting and fog, as rendered. */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { WorldEnvironment } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { WorldEnvironmentProperties } from './types';
import { instanceAs } from '../testing/reactThreeTestInstance';

function makeNode(envRef = 'SubResource("Env")'): TscnNode {
  const properties: WorldEnvironmentProperties = { name: 'WE', environment: envRef };
  return { name: 'WE', type: 'WorldEnvironment', children: [], properties };
}

function envSub(data: Record<string, string | undefined>): TscnInternalResource {
  return {
    id: 'Env',
    type: 'Environment',
    data: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
  };
}

async function render(node: TscnNode, resources: TscnInternalResource[]) {
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={resources}>
      <WorldEnvironment node={node} />
    </SceneResourcesProvider>
  );
}

describe('WorldEnvironment (assertions 81–89)', () => {
  it('#81 background_mode SKY → scene background is set (non-null)', async () => {
    const renderer = await render(makeNode(), [envSub({ background_mode: '2' })]);
    // SKY mode (2) sets some scene.background.
    expect(instanceAs<THREE.Scene>(renderer.scene).background).not.toBeNull();
  });

  it('#82 background_mode COLOR → scene.background is a THREE.Color', async () => {
    const renderer = await render(makeNode(), [
      envSub({ background_mode: '1', background_color: 'Color(1, 0, 0, 1)' }),
    ]);
    const bg = instanceAs<THREE.Scene>(renderer.scene).background as { isColor?: boolean } | null;
    expect(bg).not.toBeNull();
    expect(bg!.isColor).toBe(true);
  });

  it('#83 background_color → scene.background reflects RGB values (sRGB)', async () => {
    // Godot Color literals are sRGB and three.js converts to linear, so compare the sRGB hex
    // (getHexString), not the raw linear channels.
    const renderer = await render(makeNode(), [
      envSub({ background_mode: '1', background_color: 'Color(0.25, 0.5, 0.75, 1)' }),
    ]);
    const bg = instanceAs<THREE.Scene>(renderer.scene).background as { getHexString(): string };
    expect(bg.getHexString()).toBe('4080bf'); // (0.25,0.5,0.75) → 8-bit sRGB
  });

  it('#84 ambient_light_color (COLOR source) → ambient light color matches', async () => {
    const renderer = await render(makeNode(), [
      envSub({
        background_mode: '1',
        ambient_light_source: '2', // COLOR, required for a flat ambient
        ambient_light_color: 'Color(0.3, 0.6, 0.9, 1)',
        ambient_light_energy: '1',
      }),
    ]);
    const ambients = renderer.scene.findAllByType('AmbientLight');
    expect(ambients.length).toBeGreaterThan(0);
    const c = instanceAs<THREE.AmbientLight>(ambients[0]!).color;
    expect(c.getHexString()).toBe('4d99e6'); // (0.3,0.6,0.9) sRGB
  });

  it('#84b default ambient source (BG) → ambient comes from the BACKGROUND colour', async () => {
    // AMBIENT_SOURCE_BG (0, the default) ignores ambient_light_color entirely
    // and lights the scene from background_color. The full table is in
    // resources/environment/renderer.bg-ambient.test.ts.
    const renderer = await render(makeNode(), [
      envSub({
        background_mode: '1',
        background_color: 'Color(0.4, 0.4, 0.4, 1)',
        ambient_light_color: 'Color(0.3, 0.6, 0.9, 1)',
      }),
    ]);
    const lights = renderer.scene.findAllByType('AmbientLight');
    expect(lights.length).toBe(1);
    expect(instanceAs<THREE.AmbientLight>(lights[0]!).color.getHexString()).toBe(
      '666666'
    );
  });

  it('#85 ambient_light_energy → ambient light intensity matches', async () => {
    const renderer = await render(makeNode(), [
      envSub({
        background_mode: '1',
        ambient_light_source: '2',
        ambient_light_color: 'Color(1, 1, 1, 1)',
        ambient_light_energy: '2',
      }),
    ]);
    const ambients = renderer.scene.findAllByType('AmbientLight');
    expect(ambients.length).toBeGreaterThan(0);
    const intensity = instanceAs<THREE.AmbientLight>(ambients[0]!).intensity;

    // Godot adds a constant ambient as `ambient_light * albedo` with no 1/PI, and three multiplies
    // its unscaled irradiance by albedo/PI. So a white energy-2.0 ambient lands a Lambertian surface
    // at 2x its albedo with intensity energy * PI, asserted against PI, not the constant, which
    // would only restate the source line.
    expect(intensity).toBeCloseTo(2 * Math.PI, 6);
  });

  it('#86 fog_enabled=false → scene.fog === null', async () => {
    const renderer = await render(makeNode(), [envSub({ background_mode: '1', fog_enabled: 'false' })]);
    expect(instanceAs<THREE.Scene>(renderer.scene).fog).toBeNull();
  });

  it('#87 fog_enabled=true → scene.fog is non-null', async () => {
    const renderer = await render(makeNode(), [
      envSub({ background_mode: '1', fog_enabled: 'true', fog_density: '0.1' }),
    ]);
    expect(instanceAs<THREE.Scene>(renderer.scene).fog).not.toBeNull();
  });

  it('#88 fog_light_color → scene.fog.color matches (sRGB)', async () => {
    const renderer = await render(makeNode(), [
      envSub({
        background_mode: '1',
        fog_enabled: 'true',
        fog_density: '0.05',
        fog_light_color: 'Color(0.4, 0.5, 0.6, 1)',
      }),
    ]);
    const fog = instanceAs<THREE.Scene>(renderer.scene).fog as {
      color: { getHexString(): string };
    } | null;
    expect(fog).not.toBeNull();
    expect(fog!.color.getHexString()).toBe('668099'); // (0.4,0.5,0.6) sRGB
  });

  it('#89 fog_density → scene.fog.density matches', async () => {
    const renderer = await render(makeNode(), [
      envSub({ background_mode: '1', fog_enabled: 'true', fog_density: '0.25' }),
    ]);
    const fog = instanceAs<THREE.Scene>(renderer.scene).fog as { density: number } | null;
    expect(fog).not.toBeNull();
    expect(fog!.density).toBeCloseTo(0.25, 4);
  });
});
