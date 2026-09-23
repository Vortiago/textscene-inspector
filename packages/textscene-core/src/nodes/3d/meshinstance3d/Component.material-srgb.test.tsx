/**
 * StandardMaterial3D albedo and emission colours convert from sRGB to linear
 * once. Godot stores them in sRGB, three's material colour is linear, and the
 * renderer's `outputColorSpace = SRGB` re-applies the curve, so an unconverted
 * mid-tone renders double-encoded.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { findMesh } from '../testing/reactThreeTestInstance';

const PLANE_MESH: TscnInternalResource = {
  id: 'plane_1',
  type: 'PlaneMesh',
  data: { id: 'plane_1' },
};

async function renderWithMaterial(materialProps: Record<string, string>) {
  const material: TscnInternalResource = {
    id: 'mat_1',
    type: 'StandardMaterial3D',
    data: materialProps,
  };
  const props: MeshInstance3DProperties = {
    name: 'TestMesh',
    mesh: 'SubResource("plane_1")',
    surfaceMaterialOverrides: new Map([[0, 'SubResource("mat_1")']]),
  };
  const node: TscnNode = {
    name: 'TestMesh',
    type: 'MeshInstance3D',
    children: [],
    properties: props,
  };
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={[PLANE_MESH, material]}>
      <MeshInstance3D node={node} />
    </SceneResourcesProvider>
  );
  return findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
}

describe('StandardMaterial3D — sRGB albedo conversion (WI-HALL-2)', () => {
  it('Godot dark red Color(0.545, 0.117, 0.117) renders as dim linear red, NOT bright pink', async () => {
    // `#8B1E1E`, a dark red that renders bright pink without the conversion.
    const mat = await renderWithMaterial({
      albedo_color: 'Color(0.545098, 0.117647, 0.117647, 1)',
    });

    // Linear values: 0.545098 → ≈ 0.258 and 0.117647 → ≈ 0.013. The tolerance absorbs
    // clamp01 and prop rounding, and still fails on the unconverted sRGB inputs.
    expect(mat.color.r).toBeCloseTo(0.258, 2);
    expect(mat.color.g).toBeCloseTo(0.013, 2);
    expect(mat.color.b).toBeCloseTo(0.013, 2);

    // A converted mid-tone is strictly darker than its sRGB input.
    expect(mat.color.r).toBeLessThan(0.545098);
    expect(mat.color.g).toBeLessThan(0.117647);
    expect(mat.color.b).toBeLessThan(0.117647);

    // The conversion is monotonic per channel, so the channel order survives.
    expect(mat.color.r).toBeGreaterThan(mat.color.g);
    expect(mat.color.g).toBeCloseTo(mat.color.b, 6);
  });

  it('preserves sRGB fixed points: 0 → 0 and 1 → 1 round-trip exactly', async () => {
    // The sRGB transfer function has fixed points at 0 and 1, so black and white
    // do not shift.
    const black = await renderWithMaterial({
      albedo_color: 'Color(0, 0, 0, 1)',
    });
    expect(black.color.r).toBe(0);
    expect(black.color.g).toBe(0);
    expect(black.color.b).toBe(0);

    const white = await renderWithMaterial({
      albedo_color: 'Color(1, 1, 1, 1)',
    });
    expect(white.color.r).toBe(1);
    expect(white.color.g).toBe(1);
    expect(white.color.b).toBe(1);
  });

  it('emission color is sRGB→linear converted exactly once, not twice (#341)', async () => {
    // Emissive goes in as a linear [r,g,b] array. A hex number would let r3f's
    // Color.setHex convert it a second time, leaving the emission ~6x too dark.
    const mat = await renderWithMaterial({
      albedo_color: 'Color(1, 1, 1, 1)',
      emission_enabled: 'true',
      emission: 'Color(0.5, 0.5, 0.5, 1)',
      emission_energy_multiplier: '1',
    });

    // sRGB 0.5 → linear ≈ 0.214 after one conversion, ≈ 0.037 after two.
    expect(mat.emissive.r).toBeCloseTo(0.214, 2);
    expect(mat.emissive.g).toBeCloseTo(0.214, 2);
    expect(mat.emissive.b).toBeCloseTo(0.214, 2);
    expect(mat.emissive.r).toBeGreaterThan(0.1); // guards against the ~0.037 double-convert
  });
});
