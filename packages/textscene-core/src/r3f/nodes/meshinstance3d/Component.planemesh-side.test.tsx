/**
 * Regression test for WI-HALL-6: Canvas photo-frame plane visibility.
 *
 * The hallway photo-frame fixture (HouseKeeper.tscn + 5 siblings)
 * declares a `Canvas` MeshInstance3D backed by a PlaneMesh with a 90°
 * Y-axis rotation. Combined with PlaneMesh's default `orientation = 0`
 * (FACE_X, normal +X), the rotation flips the plane's normal away
 * from the camera. Godot's default `cull_mode = BACK` then back-culls
 * the photo into invisibility from the viewer's side.
 *
 * Pre-WI-HALL-6 the material slot used `scalars.side` verbatim, which
 * resolved to THREE.FrontSide (Godot BACK culling → only the front
 * face is visible). The Canvas plane was face-away → silently
 * invisible. The user uploaded the SarahMills.png texture, the
 * resource loaded, the material bound it — but the user saw no photo.
 *
 * Post-WI-HALL-6: when the underlying mesh is a PlaneMesh AND the
 * source material did NOT explicitly set `cull_mode`, MaterialSlot
 * upgrades to THREE.DoubleSide. The photo is now visible from either
 * side regardless of how the parent transform flips the normal.
 * Explicit `cull_mode` settings are respected verbatim — this is a
 * default-fallback, not a forced override.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from '../../../nodes/3d/meshinstance3d/types';

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

function makeNode(properties: Partial<MeshInstance3DProperties> = {}): TscnNode {
  const props: MeshInstance3DProperties = {
    name: properties.name ?? 'Canvas',
    surfaceMaterialOverrides: properties.surfaceMaterialOverrides ?? new Map(),
    mesh: properties.mesh ?? 'SubResource("plane_1")',
    materialOverride: properties.materialOverride,
    ...properties,
  };
  return { name: props.name, type: 'MeshInstance3D', children: [], properties: props };
}

async function renderWithMeshAndMaterial(
  meshType: string,
  materialProps: Record<string, string> | null
) {
  const internalResources: TscnInternalResource[] = [
    sub(meshType, 'plane_1', meshType === 'PlaneMesh' ? { size: 'Vector2(1, 1)' } : { size: 'Vector3(1, 1, 1)' }),
  ];
  if (materialProps) {
    internalResources.push(sub('StandardMaterial3D', 'mat_1', materialProps));
  }
  const node = makeNode({
    mesh: `SubResource("plane_1")`,
    surfaceMaterialOverrides: materialProps
      ? new Map([[0, `SubResource("mat_1")`]])
      : new Map(),
  });
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={internalResources}>
      <MeshInstance3D node={node} />
    </SceneResourcesProvider>
  );
  return renderer.scene.findByType('Mesh').instance.material as THREE.MeshStandardMaterial;
}

describe('MeshInstance3D + PlaneMesh — material.side default (WI-HALL-6)', () => {
  it('PlaneMesh with material lacking cull_mode defaults to DoubleSide', async () => {
    // The photo-frame Canvas case: a PlaneMesh, a StandardMaterial3D
    // with albedo color (and in practice a texture; the side decision
    // is independent of the texture binding pathway), and no explicit
    // cull_mode. The plane must be visible from both faces.
    const mat = await renderWithMeshAndMaterial('PlaneMesh', {
      albedo_color: 'Color(1, 1, 1, 1)',
    });
    expect(mat.side).toBe(THREE.DoubleSide);
  });

  it('PlaneMesh with explicit cull_mode=0 (BACK) is respected — FrontSide', async () => {
    // The user explicitly chose Godot BACK culling — respect it.
    // This protects scenes that DO want one-sided plane rendering.
    const mat = await renderWithMeshAndMaterial('PlaneMesh', {
      albedo_color: 'Color(1, 1, 1, 1)',
      cull_mode: '0',
    });
    expect(mat.side).toBe(THREE.FrontSide);
  });

  it('PlaneMesh with explicit cull_mode=1 (FRONT) is respected — BackSide', async () => {
    const mat = await renderWithMeshAndMaterial('PlaneMesh', {
      albedo_color: 'Color(1, 1, 1, 1)',
      cull_mode: '1',
    });
    expect(mat.side).toBe(THREE.BackSide);
  });

  it('PlaneMesh with explicit cull_mode=2 (DISABLED) is respected — DoubleSide', async () => {
    const mat = await renderWithMeshAndMaterial('PlaneMesh', {
      albedo_color: 'Color(1, 1, 1, 1)',
      cull_mode: '2',
    });
    expect(mat.side).toBe(THREE.DoubleSide);
  });

  it('BoxMesh with no cull_mode keeps FrontSide (defensive fallback is PlaneMesh-only)', async () => {
    // The override is intentionally targeted at planes. BoxMesh /
    // SphereMesh / etc. have a natural "inside" that the user probably
    // doesn't want double-sided by default — preserving FrontSide here
    // means existing fixtures that rely on inside-not-visible rendering
    // don't break.
    const mat = await renderWithMeshAndMaterial('BoxMesh', {
      albedo_color: 'Color(1, 1, 1, 1)',
    });
    expect(mat.side).toBe(THREE.FrontSide);
  });

  it('PlaneMesh without any material falls back to the gray default material on DoubleSide', async () => {
    // A bare PlaneMesh without a StandardMaterial3D still benefits
    // from the defensive default — same reason: a rotated raw
    // PlaneMesh shouldn't silently disappear.
    const mat = await renderWithMeshAndMaterial('PlaneMesh', null);
    expect(mat.side).toBe(THREE.DoubleSide);
  });
});
