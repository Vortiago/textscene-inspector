/**
 * Regression test for WI-HALL-2: sRGB → linear conversion for
 * StandardMaterial3D albedo + emission colors.
 *
 * Godot stores material colors in sRGB. three.js's
 * `<meshStandardMaterial color={...}>` prop treats incoming RGB values
 * as linear; the renderer's `outputColorSpace = SRGB` re-applies the
 * gamma curve on output. Without an intermediate sRGB → linear
 * conversion, mid-tone colors render double-encoded — a Godot dark red
 * `Color(0.545, 0.117, 0.117)` (`#8B1E1E`) came out as bright saturated
 * pink, which ld58-verifier flagged on the hallway fixture.
 *
 * Post-WI-HALL-2: `materialScalars.parseStandardMaterial3DScalars`
 * converts the parsed albedo + emission via the standard sRGB inverse
 * transfer function before exposing them. The downstream
 * `<meshStandardMaterial>` then receives true linear values; the
 * renderer's output transform produces the correct mid-tone.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from '../../../nodes/3d/meshinstance3d/types';

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
  return renderer.scene.findByType('Mesh').instance.material as THREE.MeshStandardMaterial;
}

describe('StandardMaterial3D — sRGB albedo conversion (WI-HALL-2)', () => {
  it('Godot dark red Color(0.545, 0.117, 0.117) renders as dim linear red, NOT bright pink', async () => {
    // The hallway-fixture defect: `albedo_color = Color(0.545098, 0.117647, 0.117647, 1)`.
    // In Godot's editor this is `#8B1E1E` (dark red, brick-tone). Without
    // sRGB conversion, three.js would render the values verbatim and the
    // sRGB output transform brightens to bright saturated pink.
    const mat = await renderWithMaterial({
      albedo_color: 'Color(0.545098, 0.117647, 0.117647, 1)',
    });

    // Linear-space expected values (sRGB inverse transfer):
    //   0.545098 → ≈ 0.258 (dim, brick-tone)
    //   0.117647 → ≈ 0.013 (almost black)
    // Tolerance loose enough to tolerate the small clamp01 + R3F prop
    // rounding that happens between parse and the THREE material; tight
    // enough to fail if the conversion is skipped (the sRGB inputs are
    // 0.545 / 0.117, far outside the linear ranges).
    expect(mat.color.r).toBeCloseTo(0.258, 2);
    expect(mat.color.g).toBeCloseTo(0.013, 2);
    expect(mat.color.b).toBeCloseTo(0.013, 2);

    // Load-bearing sanity: linear red MUST be strictly less than the
    // sRGB input for these mid-tones. If this assertion ever flips, the
    // fix has regressed and the user is back to the bright-pink bug.
    expect(mat.color.r).toBeLessThan(0.545098);
    expect(mat.color.g).toBeLessThan(0.117647);
    expect(mat.color.b).toBeLessThan(0.117647);

    // Cross-channel sanity: a Godot RED still has the highest R and
    // equal G/B. The conversion is monotonic per-channel; relative
    // ordering survives.
    expect(mat.color.r).toBeGreaterThan(mat.color.g);
    expect(mat.color.g).toBeCloseTo(mat.color.b, 6);
  });

  it('preserves sRGB fixed points: 0 → 0 and 1 → 1 round-trip exactly', async () => {
    // The sRGB transfer function has fixed points at 0 and 1, so pure
    // black and pure white must NOT shift. The mid-tone bug shouldn't
    // accidentally bleed into endpoints.
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

  it('emission color is also sRGB-converted when emission_enabled=true', async () => {
    // Godot's emission color is also sRGB. Apply the same conversion or
    // a bright emissive looks subtly too-warm.
    const mat = await renderWithMaterial({
      albedo_color: 'Color(1, 1, 1, 1)',
      emission_enabled: 'true',
      emission: 'Color(0.5, 0.5, 0.5, 1)',
      emission_energy_multiplier: '1',
    });

    // emission is stored as a hex int in the scalars layer. Convert
    // back from hex and assert the bytes correspond to linear values,
    // not sRGB.
    const hex = mat.emissive.getHex();
    const r = ((hex >> 16) & 0xff) / 255;
    const g = ((hex >> 8) & 0xff) / 255;
    const b = (hex & 0xff) / 255;

    // sRGB 0.5 → linear ≈ 0.214. After quantisation to 8 bits via
    // rgbToHex (round(0.214 * 255) = 55 = 0x37 → 0.2156), all three
    // channels should land near 0.215, NOT 0.5.
    expect(r).toBeCloseTo(0.2156, 2);
    expect(g).toBeCloseTo(0.2156, 2);
    expect(b).toBeCloseTo(0.2156, 2);
  });
});
