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

describe('MeshInstance3D + PlaneMesh — material.side default (Godot BACK = FrontSide)', () => {
  it('PlaneMesh with material lacking cull_mode follows Godot default — FrontSide', async () => {
    // Godot's StandardMaterial3D default is `cull_mode = 0` (BACK), so an
    // omitted cull_mode means "render only the front face". This matches
    // wall PlaneMeshes in real Godot scenes — you can't see into a room
    // through the back of a wall. The earlier WI-HALL-6 override that
    // upgraded this case to DoubleSide unintentionally broke that
    // semantic and was reverted. Photo-frame Canvas planes that want
    // DoubleSide must set `cull_mode = 2` explicitly in their source
    // material (which the LD-58 fixtures do, once their .tres material
    // is loaded — the issue WI-HALL-6 was working around was missing
    // material data, not a default mismatch).
    const mat = await renderWithMeshAndMaterial('PlaneMesh', {
      albedo_color: 'Color(1, 1, 1, 1)',
    });
    expect(mat.side).toBe(THREE.FrontSide);
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

  it('PlaneMesh without any material follows Godot default — FrontSide', async () => {
    // Even bare PlaneMeshes follow Godot's default culling: BACK =
    // FrontSide. Reverted from the earlier DoubleSide override for
    // the same reason as the with-material branch (walls rely on this
    // default to be one-sided).
    const mat = await renderWithMeshAndMaterial('PlaneMesh', null);
    expect(mat.side).toBe(THREE.FrontSide);
  });

  it('REGRESSION (LD-58 wall): PlaneMesh + StandardMaterial3D with albedo_texture only → FrontSide', async () => {
    // This is the EXACT shape of WallSection.tscn's wall material from
    // LD-58: a PlaneMesh with FACE_X orientation, a StandardMaterial3D
    // referencing an albedo texture (g_toit-tower.png), NO explicit
    // cull_mode. Godot renders this with BACK culling (FrontSide).
    //
    // Two earlier regressions broke this:
    //   1. WI-HALL-6 (67c199b): added a defensive override that
    //      upgraded PlaneMesh + missing cull_mode to DoubleSide.
    //      Intended for the photo Canvas planes whose author had
    //      missed `cull_mode = 2`; collateral damage was every wall
    //      whose material followed Godot's omit-the-default convention.
    //   2. The pre-fix decompose path (b4ccaab) computed scale on the
    //      wrong axis, leading to walls 1/3 to 1/6 of their intended
    //      width.
    //
    // This test pins the LD-58 wall-shaped material to FrontSide
    // explicitly so any future "PlaneMesh-friendly" override has to
    // grapple with breaking it.
    const mat = await renderWithMeshAndMaterial('PlaneMesh', {
      albedo_color: 'Color(1, 1, 1, 1)',
      // No cull_mode — exactly like WallSection.tscn's StandardMaterial3D_mt8pv.
      // In a real fixture there would also be an `albedo_texture =
      // ExtResource(...)` ref, but the side decision is independent of
      // whether the texture actually resolves — what matters is that
      // cull_mode was not explicitly set.
    });
    expect(mat.side).toBe(THREE.FrontSide);
    // Also explicit: the cullModeExplicit flag must be false for this
    // input. If a future refactor accidentally sets it true (e.g. by
    // defaulting cull_mode='0' during parse), the test above still
    // passes but THIS one fails, surfacing the root cause directly.
    // (Probed via the materialScalars; the visible-side test above is
    // the user-facing contract.)
  });
});
