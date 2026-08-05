/**
 * Parity for lower-frequency StandardMaterial3D features:
 * - vertex_color_use_as_albedo → three.js vertexColors
 * - emission HDR (channel > 1) preserved by folding the peak into intensity
 *   (three.js emissive is [0,1]; brightness rides on emissiveIntensity)
 * - ao_enabled gate: aoMap only applies when the feature flag is on (Godot
 *   samples ao_texture only when ao_enabled).
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseStandardMaterial3DScalars } from '../../../r3f/materials/standardMaterialScalars';
import { StandardMaterialSlot } from '../../../r3f/materials/StandardMaterialSlot';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { findMesh } from '../testing/reactThreeTestInstance';

describe('material misc scalar parity', () => {
  it('vertex_color_use_as_albedo → useVertexColors (default false)', () => {
    expect(parseStandardMaterial3DScalars({}).useVertexColors).toBe(false);
    expect(
      parseStandardMaterial3DScalars({ vertex_color_use_as_albedo: 'true' }).useVertexColors
    ).toBe(true);
  });

  it('ao_enabled → aoEnabled (default false)', () => {
    expect(parseStandardMaterial3DScalars({}).aoEnabled).toBe(false);
    expect(parseStandardMaterial3DScalars({ ao_enabled: 'true' }).aoEnabled).toBe(true);
  });

  it('HDR emission folds the LINEAR peak into emissiveIntensity, preserving hue', () => {
    const s = parseStandardMaterial3DScalars({
      emission_enabled: 'true',
      emission: 'Color(2, 0.5, 0, 1)',
      emission_energy_multiplier: '1',
    });
    // Godot converts the `source_color` uniform sRGB→linear BEFORE energy, and
    // its `pow` branch extrapolates past 1 rather than clipping:
    //   ((2 + 0.055) / 1.055) ^ 2.4     = 4.9538457…
    //   ((0.5 + 0.055) / 1.055) ^ 2.4   = 0.2140411…
    // The peak goes into the intensity, so the colour keeps its ratio.
    expect(s.emissiveIntensity).toBeCloseTo(4.9538458, 6);
    expect(s.emissive[0]).toBeCloseTo(1, 5);
    expect(s.emissive[1]).toBeCloseTo(0.2140411 / 4.9538458, 5);
    expect(s.emissive[2]).toBe(0);
  });

  it('non-HDR emission leaves intensity = energy', () => {
    const s = parseStandardMaterial3DScalars({
      emission_enabled: 'true',
      emission: 'Color(0.5, 0, 0, 1)',
      emission_energy_multiplier: '3',
    });
    expect(s.emissiveIntensity).toBeCloseTo(3, 5);
  });
});

describe('StandardMaterialSlot vertexColors', () => {
  it('useVertexColors → material.vertexColors true', async () => {
    const scalars = parseStandardMaterial3DScalars({ vertex_color_use_as_albedo: 'true' });
    const r = await ReactThreeTestRenderer.create(
      <mesh>
        <StandardMaterialSlot scalars={scalars} />
      </mesh>
    );
    const m = findMesh(r.scene).material as THREE.MeshStandardMaterial;
    expect(m.vertexColors).toBe(true);
  });

  it('unshaded (MeshBasicMaterial) also honors vertex_color_use_as_albedo', async () => {
    const scalars = parseStandardMaterial3DScalars({
      shading_mode: '0', // unshaded
      vertex_color_use_as_albedo: 'true',
    });
    const r = await ReactThreeTestRenderer.create(
      <mesh>
        <StandardMaterialSlot scalars={scalars} />
      </mesh>
    );
    const m = findMesh(r.scene).material as THREE.MeshBasicMaterial;
    expect((m as THREE.Material).type).toBe('MeshBasicMaterial');
    expect(m.vertexColors).toBe(true);
  });

  it('unshaded drops emission entirely, as Godot does', async () => {
    // Godot's unshaded branch writes `vec4(albedo, alpha)` and never reads the
    // emission term, so a bright emissive unshaded material is unlit in Godot
    // too. Pinned so the missing emissive here is not mistaken for a gap.
    const scalars = parseStandardMaterial3DScalars({
      shading_mode: '0',
      emission_enabled: 'true',
      emission: 'Color(1, 0, 0, 1)',
      emission_energy_multiplier: '8',
    });
    const r = await ReactThreeTestRenderer.create(
      <mesh>
        <StandardMaterialSlot scalars={scalars} />
      </mesh>
    );
    const m = findMesh(r.scene).material as THREE.Material;
    expect(m.type).toBe('MeshBasicMaterial');
    expect('emissive' in m).toBe(false);
  });
});

const AO_TEX = 'res://ao.png';

async function renderAo(matData: Record<string, string>): Promise<THREE.MeshStandardMaterial> {
  const fake = createFakeResourceLoader();
  fake.textures.seed(AO_TEX, new THREE.Texture());
  const props: MeshInstance3DProperties = {
    name: 'M',
    surfaceMaterialOverrides: new Map(),
    mesh: 'SubResource("Box")',
    materialOverride: 'SubResource("Mat")',
  };
  const node: TscnNode = { name: 'M', type: 'MeshInstance3D', children: [], properties: props };
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider
        internalResources={[
          { id: 'Box', type: 'BoxMesh', data: { size: 'Vector3(1,1,1)' } },
          { id: 'Mat', type: 'StandardMaterial3D', data: matData },
        ]}
        externalResources={[{ id: '1', type: 'Texture2D', path: AO_TEX }]}
      >
        <MeshInstance3D node={node} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  return findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
}

describe('ao_enabled gate', () => {
  it('applies aoMap only when ao_enabled is true', async () => {
    const enabled = await renderAo({ ao_enabled: 'true', ao_texture: 'ExtResource("1")' });
    expect(enabled.aoMap).not.toBeNull();
  });

  it('drops aoMap when ao_enabled is absent (Godot default false)', async () => {
    const disabled = await renderAo({ ao_texture: 'ExtResource("1")' });
    expect(disabled.aoMap).toBeNull();
  });
});
