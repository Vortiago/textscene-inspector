/**
 * Strict-verification harness (group C) — 14 assertions covering
 * StandardMaterial3D scalar properties (color, metallic, roughness,
 * opacity, emission, transparency, blend_mode, cull_mode).
 *
 * Assertions: 18–31 of `docs/archive/STRICT-VERIFICATION.md`.
 *
 * Several of these test for properties Godot exposes but our R3F port may
 * not have wired up yet. Failures here are the inventory of silent
 * feature-misses.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { findMesh } from '../testing/reactThreeTestInstance';

function makeNode(properties: Partial<MeshInstance3DProperties> = {}): TscnNode {
  const props: MeshInstance3DProperties = {
    name: properties.name ?? 'M',
    surfaceMaterialOverrides: properties.surfaceMaterialOverrides ?? new Map(),
    mesh: properties.mesh ?? 'SubResource("Box_1")',
    materialOverride: properties.materialOverride,
    ...properties,
  };
  return { name: props.name, type: 'MeshInstance3D', children: [], properties: props };
}

function sub(
  type: string,
  id: string,
  data: Record<string, string | undefined> = {}
): TscnInternalResource {
  return {
    id,
    type,
    data: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
  };
}

async function renderWithMaterial(
  matData: Record<string, string | undefined>,
  matId = 'Mat'
) {
  const node = makeNode({ materialOverride: `SubResource("${matId}")` });
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider
      internalResources={[
        sub('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' }),
        sub('StandardMaterial3D', matId, matData),
      ]}
    >
      <MeshInstance3D node={node} />
    </SceneResourcesProvider>
  );
  return findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
}

describe('StandardMaterial3D scalars (assertions 18–31)', () => {
  it('#18 albedo_color RGB → material.color matches (sRGB → linear, WI-HALL-2)', async () => {
    const mat = await renderWithMaterial({ albedo_color: 'Color(0.5, 0.25, 0.75, 1)' });
    // Godot encodes colors in sRGB; we convert to linear so
    // three.js's sRGB output transform doesn't double-encode and the
    // user sees the true mid-tone (not bright-pink). Assert the
    // sRGB → linear conversion happened: 0.5 → ~0.214, 0.25 → ~0.0508,
    // 0.75 → ~0.523. Strictly different from the original sRGB inputs.
    expect(mat.color.r).toBeCloseTo(0.21404, 4);
    expect(mat.color.g).toBeCloseTo(0.05088, 4);
    expect(mat.color.b).toBeCloseTo(0.52252, 4);
  });

  it('#19 albedo_color alpha < 1 (ALPHA mode) → opacity matches AND transparent=true', async () => {
    // Godot: alpha < 1 is only transparent when transparency != DISABLED.
    const mat = await renderWithMaterial({ transparency: '1', albedo_color: 'Color(1, 1, 1, 0.4)' });
    expect(mat.opacity).toBeCloseTo(0.4, 4);
    expect(mat.transparent).toBe(true);
  });

  it('#19b albedo_color alpha < 1 with transparency DISABLED → opaque (Godot ignores alpha)', async () => {
    const mat = await renderWithMaterial({ albedo_color: 'Color(1, 1, 1, 0.4)' });
    expect(mat.transparent).toBe(false);
  });

  it('#20 metallic=0 → material.metalness === 0', async () => {
    const mat = await renderWithMaterial({ metallic: '0' });
    expect(mat.metalness).toBe(0);
  });

  it('#21 metallic=1 → material.metalness === 1', async () => {
    const mat = await renderWithMaterial({ metallic: '1' });
    expect(mat.metalness).toBe(1);
  });

  it('#22 metallic=0.5 → material.metalness === 0.5', async () => {
    const mat = await renderWithMaterial({ metallic: '0.5' });
    expect(mat.metalness).toBe(0.5);
  });

  it('#23 roughness=0 → material.roughness === 0', async () => {
    const mat = await renderWithMaterial({ roughness: '0' });
    expect(mat.roughness).toBe(0);
  });

  it('#24 roughness=1 → material.roughness === 1', async () => {
    const mat = await renderWithMaterial({ roughness: '1' });
    expect(mat.roughness).toBe(1);
  });

  it('#25 albedo_color alpha < 1 (ALPHA mode) → opacity matches AND transparent=true', async () => {
    const mat = await renderWithMaterial({ transparency: '1', albedo_color: 'Color(1, 1, 1, 0.2)' });
    expect(mat.opacity).toBeCloseTo(0.2, 4);
    expect(mat.transparent).toBe(true);
  });

  it('#26 emission_enabled=false → material.emissiveIntensity === 0', async () => {
    const mat = await renderWithMaterial({
      emission_enabled: 'false',
      emission: 'Color(1, 0, 0, 1)',
      emission_energy_multiplier: '5',
    });
    expect(mat.emissiveIntensity).toBe(0);
  });

  it('#27 emission_enabled=true + emission color → material.emissive matches', async () => {
    const mat = await renderWithMaterial({
      emission_enabled: 'true',
      emission: 'Color(1, 0, 0, 1)',
    });
    // Pure red emission → emissive.r ≈ 1, .g ≈ 0, .b ≈ 0.
    expect(mat.emissive.r).toBeCloseTo(1, 2);
    expect(mat.emissive.g).toBeCloseTo(0, 2);
    expect(mat.emissive.b).toBeCloseTo(0, 2);
  });

  it('#28 emission_energy_multiplier → material.emissiveIntensity matches', async () => {
    const mat = await renderWithMaterial({
      emission_enabled: 'true',
      emission: 'Color(1, 1, 1, 1)',
      emission_energy_multiplier: '3',
    });
    expect(mat.emissiveIntensity).toBeCloseTo(3, 4);
  });

  it('#29 transparency=1 (ALPHA mode) → material.transparent === true', async () => {
    // Even without alpha < 1 on the color, Godot's `transparency` flag forces transparent.
    const mat = await renderWithMaterial({
      albedo_color: 'Color(1, 1, 1, 1)',
      transparency: '1',
    });
    expect(mat.transparent).toBe(true);
  });

  it('#30 blend_mode=ADD → material.blending === THREE.AdditiveBlending', async () => {
    const mat = await renderWithMaterial({
      albedo_color: 'Color(1, 1, 1, 1)',
      blend_mode: '1', // Godot: 1 = ADD
    });
    expect(mat.blending).toBe(THREE.AdditiveBlending);
  });

  it('#31 cull_mode=DISABLED → material.side === THREE.DoubleSide', async () => {
    const mat = await renderWithMaterial({
      albedo_color: 'Color(1, 1, 1, 1)',
      cull_mode: '2', // Godot CULL_DISABLED = 2
    });
    expect(mat.side).toBe(THREE.DoubleSide);
  });
});
