/**
 * Strict-verification harness (WI-R3F-9, group I) — 9 assertions covering
 * WorldEnvironment background, ambient lighting, and fog.
 *
 * Assertions: 81–89 of `work_items/STRICT-VERIFICATION.md`.
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { WorldEnvironment } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { WorldEnvironmentProperties } from './types';

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
    // SKY mode (2) should produce SOME scene.background — historically a
    // CubeTexture or a gradient sky. Our implementation today only handles
    // BG_COLOR and BG_CLEAR_COLOR, so this asserts the gap.
    expect(renderer.scene.instance.background).not.toBeNull();
  });

  it('#82 background_mode COLOR → scene.background is a THREE.Color', async () => {
    const renderer = await render(makeNode(), [
      envSub({ background_mode: '1', background_color: 'Color(1, 0, 0, 1)' }),
    ]);
    const bg = renderer.scene.instance.background as { isColor?: boolean } | null;
    expect(bg).not.toBeNull();
    expect(bg!.isColor).toBe(true);
  });

  it('#83 background_color → scene.background reflects RGB values', async () => {
    const renderer = await render(makeNode(), [
      envSub({ background_mode: '1', background_color: 'Color(0.25, 0.5, 0.75, 1)' }),
    ]);
    const bg = renderer.scene.instance.background as { r: number; g: number; b: number };
    expect(bg.r).toBeCloseTo(0.25, 2);
    expect(bg.g).toBeCloseTo(0.5, 2);
    expect(bg.b).toBeCloseTo(0.75, 2);
  });

  it('#84 ambient_light_color → ambient light color matches', async () => {
    // Environment's ambient_light is a separate optional sub-property of
    // the Godot Environment resource. The current parser/renderer doesn't
    // capture it. This assertion catches the gap.
    const renderer = await render(makeNode(), [
      envSub({
        background_mode: '1',
        ambient_light_color: 'Color(0.3, 0.6, 0.9, 1)',
        ambient_light_energy: '1',
      }),
    ]);
    const ambients = renderer.scene.findAllByType('AmbientLight');
    expect(ambients.length).toBeGreaterThan(0);
    const c = (ambients[0]!.instance as { color: { r: number; g: number; b: number } }).color;
    expect(c.r).toBeCloseTo(0.3, 1);
    expect(c.g).toBeCloseTo(0.6, 1);
    expect(c.b).toBeCloseTo(0.9, 1);
  });

  it('#85 ambient_light_energy → ambient light intensity matches', async () => {
    const renderer = await render(makeNode(), [
      envSub({
        background_mode: '1',
        ambient_light_color: 'Color(1, 1, 1, 1)',
        ambient_light_energy: '2',
      }),
    ]);
    const ambients = renderer.scene.findAllByType('AmbientLight');
    expect(ambients.length).toBeGreaterThan(0);
    const intensity = (ambients[0]!.instance as { intensity: number }).intensity;
    expect(intensity).toBeCloseTo(2, 3);
  });

  it('#86 fog_enabled=false → scene.fog === null', async () => {
    const renderer = await render(makeNode(), [
      envSub({ background_mode: '1', volumetric_fog_enabled: 'false' }),
    ]);
    expect(renderer.scene.instance.fog).toBeNull();
  });

  it('#87 fog_enabled=true → scene.fog is non-null', async () => {
    const renderer = await render(makeNode(), [
      envSub({
        background_mode: '1',
        volumetric_fog_enabled: 'true',
        volumetric_fog_density: '0.1',
      }),
    ]);
    expect(renderer.scene.instance.fog).not.toBeNull();
  });

  it('#88 fog_color (volumetric_fog_albedo) → scene.fog.color matches', async () => {
    const renderer = await render(makeNode(), [
      envSub({
        background_mode: '1',
        volumetric_fog_enabled: 'true',
        volumetric_fog_density: '0.05',
        volumetric_fog_albedo: 'Color(0.4, 0.5, 0.6, 1)',
      }),
    ]);
    const fog = renderer.scene.instance.fog as { color: { r: number; g: number; b: number } } | null;
    expect(fog).not.toBeNull();
    expect(fog!.color.r).toBeCloseTo(0.4, 1);
    expect(fog!.color.g).toBeCloseTo(0.5, 1);
    expect(fog!.color.b).toBeCloseTo(0.6, 1);
  });

  it('#89 fog_density → scene.fog.density matches', async () => {
    const renderer = await render(makeNode(), [
      envSub({
        background_mode: '1',
        volumetric_fog_enabled: 'true',
        volumetric_fog_density: '0.25',
      }),
    ]);
    const fog = renderer.scene.instance.fog as { density: number } | null;
    expect(fog).not.toBeNull();
    expect(fog!.density).toBeCloseTo(0.25, 4);
  });
});
