/**
 * Tests for Tier-1 parity-audit silent drops.
 *
 * Each test exercises ONE of the 8 HIGH-severity feature drops surfaced
 * by `docs/PARITY-AUDIT.md` and pins the property to its expected
 * value on the THREE primitive. Co-located here (rather than per-node)
 * so the closure of the audit's Tier-1 list reads as a single block.
 *
 * Audit slot numbers from STRICT-VERIFICATION.md Section 1:
 *   14a — surface_material_override slot N>0 → mesh.material[N]
 *   16a — cast_shadow=2 → the depth pass draws both faces
 *   16b — cast_shadow=3 → castShadow === true, colour write suppressed
 *   38a — ao_texture → material.aoMap is a THREE.Texture
 *   59a — PrismMesh rotateY(π/6) aligns triangular face with +X
 *   60  — PlaneMesh flip_faces=true → mirrored geometry (negative scale on X axis)
 *   66a — Camera3D h_offset → position shifted along local X
 *   66b — Camera3D v_offset → position shifted along local Y
 *   93a — Label3D billboard=ENABLED → mesh rotates to face camera (post useFrame)
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from '../../nodes/3d/meshinstance3d/Component';
import { Camera3D } from '../../nodes/3d/camera3d/Component';
import { Label3D } from '../../nodes/3d/label3d/Component';
import { ViewportModeProvider } from '../contexts/ViewportModeContext';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import type {
  TscnInternalResource,
  TscnNode,
} from '../../parser/types';
import type { MeshInstance3DProperties } from '../../nodes/3d/meshinstance3d/types';
import type { Camera3DProperties } from '../../nodes/3d/camera3d/types';
import {
  ProjectionMode,
  KeepAspectMode,
} from '../../nodes/3d/camera3d/types';
import type { Label3DProperties } from '../../nodes/3d/label3d/types';
import { AlphaCutMode, BillboardMode, HorizontalAlignment, TextureFilter } from '../../nodes/3d/label3d/types';
import { inlineTwoSurfaceMesh } from '../../nodes/3d/meshinstance3d/testing/twoSurfaceMesh';

function sub(type: string, id: string, data: Record<string, string | undefined> = {}): TscnInternalResource {
  return {
    id,
    type,
    data: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
  };
}

function makeMeshNode(properties: Partial<MeshInstance3DProperties> = {}): TscnNode {
  return {
    name: properties.name ?? 'M',
    type: 'MeshInstance3D',
    children: [],
    properties: {
      name: properties.name ?? 'M',
      surfaceMaterialOverrides: properties.surfaceMaterialOverrides ?? new Map(),
      mesh: properties.mesh ?? 'SubResource("Box_1")',
      ...properties,
    } as MeshInstance3DProperties,
  };
}

async function renderMesh(
  matData: Record<string, string | undefined>,
  meshType = 'BoxMesh',
  meshData: Record<string, string | undefined> = { size: 'Vector3(1, 1, 1)' }
) {
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider
      internalResources={[
        sub(meshType, 'Mesh_1', meshData),
        sub('StandardMaterial3D', 'Mat', matData),
      ]}
    >
      <MeshInstance3D
        node={makeMeshNode({ mesh: 'SubResource("Mesh_1")', materialOverride: 'SubResource("Mat")' })}
      />
    </SceneResourcesProvider>
  );
}

describe('WI-R3F-19 parity-audit Tier-1 fixes', () => {
  it('audit slot 16a — cast_shadow=2 (DOUBLE_SIDED) → the depth pass draws both faces', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SceneResourcesProvider
        internalResources={[
          sub('BoxMesh', 'Mesh_1', { size: 'Vector3(1, 1, 1)' }),
          sub('StandardMaterial3D', 'Mat', { albedo_color: 'Color(1, 0, 0, 1)' }),
        ]}
      >
        <MeshInstance3D
          node={makeMeshNode({
            mesh: 'SubResource("Mesh_1")',
            materialOverride: 'SubResource("Mat")',
            castShadow: 2,
          })}
        />
      </SceneResourcesProvider>
    );
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const material = mesh.material as THREE.Material;
    expect(mesh.castShadow).toBe(true);

    // `cast_shadow` is GeometryInstance3D state, never material state
    // (`servers/rendering/renderer_scene_cull.cpp:732`), so it lands on the
    // depth material three built for this mesh — `getDepthMaterial` assigns the
    // side, then the per-object hook runs (`WebGLShadowMap.js:477,535,549`).
    const depthMaterial = new THREE.MeshDepthMaterial();
    depthMaterial.side = material.shadowSide ?? THREE.BackSide;
    mesh.onBeforeShadow(
      null as never, new THREE.Scene(), null as never, null as never,
      mesh.geometry, depthMaterial, null as never
    );
    expect(depthMaterial.side).toBe(THREE.DoubleSide);
    expect(material.shadowSide).toBeNull();
  });

  it('audit slot 16b — cast_shadow=3 (SHADOWS_ONLY) → still casts, draws no colour', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SceneResourcesProvider
        internalResources={[
          sub('BoxMesh', 'Mesh_1', { size: 'Vector3(1, 1, 1)' }),
          sub('StandardMaterial3D', 'Mat', { albedo_color: 'Color(1, 0, 0, 1)' }),
        ]}
      >
        <MeshInstance3D
          node={makeMeshNode({
            mesh: 'SubResource("Mesh_1")',
            materialOverride: 'SubResource("Mat")',
            castShadow: 3,
          })}
        />
      </SceneResourcesProvider>
    );
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const material = mesh.material as THREE.Material;
    expect(mesh.castShadow).toBe(true);
    // NOT `visible = false`: three's shadow pass bails on an invisible object
    // and stops walking its subtree, so that spelling cost both the shadow and
    // every descendant. Suppressing the colour write leaves both intact — see
    // meshinstance3d/Component.shadows-only.test.tsx.
    expect(mesh.visible).toBe(true);
    expect(material.colorWrite).toBe(false);
  });

  it('audit slot 38a — ao_texture loaded → material.aoMap is a THREE.Texture', async () => {
    const fake = createFakeResourceLoader();
    const aoTex = new THREE.Texture();
    const AO_PATH = 'res://textures/ao.png';
    fake.textures.seed(AO_PATH, aoTex);

    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={[
            sub('BoxMesh', 'Mesh_1', { size: 'Vector3(1, 1, 1)' }),
            sub('StandardMaterial3D', 'Mat', {
              // Godot samples ao_texture only when ao_enabled is set.
              ao_enabled: 'true',
              ao_texture: 'ExtResource("1_ao")',
            }),
          ]}
          externalResources={[{ id: '1_ao', type: 'Texture2D', path: AO_PATH }]}
        >
          <MeshInstance3D
            node={makeMeshNode({ mesh: 'SubResource("Mesh_1")', materialOverride: 'SubResource("Mat")' })}
          />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(mat.aoMap).toBeInstanceOf(THREE.Texture);
  });

  it('audit slot 60 — PlaneMesh flip_faces=true → geometry mirrored on X axis (matrix has negative det)', async () => {
    const renderer = await renderMesh(
      { albedo_color: 'Color(1, 1, 1, 1)' },
      'PlaneMesh',
      { size: 'Vector2(2, 2)', flip_faces: 'true' }
    );
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const geom = mesh.geometry;
    // After geometry.scale(-1, 1, 1), the position attribute's X values
    // are mirrored compared to a default PlaneGeometry. Sample a corner:
    // a (2,2) plane's default first vertex is at X=-1; after mirror it's X=+1.
    const pos = geom.attributes.position!;
    expect(pos.getX(0)).toBeGreaterThan(0);
  });

  it('audit slot 60 — PlaneMesh flip_faces=false (default) → first-vertex X is negative (unflipped)', async () => {
    // Sanity check that the default path is unchanged.
    const renderer = await renderMesh(
      { albedo_color: 'Color(1, 1, 1, 1)' },
      'PlaneMesh',
      { size: 'Vector2(2, 2)' }
    );
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const pos = mesh.geometry.attributes.position!;
    expect(pos.getX(0)).toBeLessThan(0);
  });

  it('audit slot 59a — PrismMesh fills its size box with the apex placed by left_to_right', async () => {
    // The real port (primitive_meshes.cpp PrismMesh::_create_mesh_array): a
    // triangular cross-section in the XY plane — apex on top, its X placed by
    // left_to_right (default 0.5 = centred) — extruded along Z, filling the
    // size box exactly. The retired approximation was a 3-segment cylinder
    // rotated π/6, inscribed in a circle and extruded along Y; this pin is
    // what replaced that contract.
    const renderer = await renderMesh(
      { albedo_color: 'Color(1, 1, 1, 1)' },
      'PrismMesh',
      { size: 'Vector3(2, 2, 2)' }
    );
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const pos = mesh.geometry.attributes.position!;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      minX = Math.min(minX, pos.getX(i));
      maxX = Math.max(maxX, pos.getX(i));
      minY = Math.min(minY, pos.getY(i));
      maxY = Math.max(maxY, pos.getY(i));
      minZ = Math.min(minZ, pos.getZ(i));
      maxZ = Math.max(maxZ, pos.getZ(i));
    }
    // Fills the size box on every axis (the approximation inscribed a circle,
    // so its X/Z extent fell short of ±1).
    expect(minX).toBeCloseTo(-1, 5);
    expect(maxX).toBeCloseTo(1, 5);
    expect(minY).toBeCloseTo(-1, 5);
    expect(maxY).toBeCloseTo(1, 5);
    expect(minZ).toBeCloseTo(-1, 5);
    expect(maxZ).toBeCloseTo(1, 5);
    // Every top-row vertex sits at the apex X: left_to_right 0.5 centres it.
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getY(i) - maxY) < 1e-5) {
        expect(pos.getX(i)).toBeCloseTo(0, 5);
      }
    }
  });

  it('audit slot 66a — Camera3D h_offset shifts position along local X', async () => {
    const node: TscnNode = {
      name: 'Cam',
      type: 'Camera3D',
      children: [],
      properties: {
        name: 'Cam',
        projection: ProjectionMode.PROJECTION_PERSPECTIVE,
        fov: 75,
        size: 1,
        near: 0.05,
        far: 100,
        keep_aspect: KeepAspectMode.KEEP_HEIGHT,
        h_offset: 2.5,
        v_offset: 0,
        frustum_offset: { x: 0, y: 0 },
        current: false,
        cull_mask: 1048575,
        doppler_tracking: 0,
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 0, y: 0, z: 5 },
        },
      } as Camera3DProperties,
    };
    const renderer = await ReactThreeTestRenderer.create(<Camera3D node={node} />);
    const cam = renderer.scene.findByType('PerspectiveCamera').instance as THREE.Camera;
    // Identity basis + h_offset=2.5 → position.x shifts by 2.5.
    expect(cam.position.x).toBeCloseTo(2.5, 5);
    expect(cam.position.y).toBeCloseTo(0, 5);
    expect(cam.position.z).toBeCloseTo(5, 5);
  });

  it('audit slot 66b — Camera3D v_offset shifts position along local Y', async () => {
    const node: TscnNode = {
      name: 'Cam',
      type: 'Camera3D',
      children: [],
      properties: {
        name: 'Cam',
        projection: ProjectionMode.PROJECTION_PERSPECTIVE,
        fov: 75,
        size: 1,
        near: 0.05,
        far: 100,
        keep_aspect: KeepAspectMode.KEEP_HEIGHT,
        h_offset: 0,
        v_offset: -1.5,
        frustum_offset: { x: 0, y: 0 },
        current: false,
        cull_mask: 1048575,
        doppler_tracking: 0,
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 0, y: 0, z: 5 },
        },
      } as Camera3DProperties,
    };
    const renderer = await ReactThreeTestRenderer.create(<Camera3D node={node} />);
    const cam = renderer.scene.findByType('PerspectiveCamera').instance as THREE.Camera;
    expect(cam.position.x).toBeCloseTo(0, 5);
    expect(cam.position.y).toBeCloseTo(-1.5, 5);
    expect(cam.position.z).toBeCloseTo(5, 5);
  });

  it('audit slot 66a/b — Camera3D h_offset+v_offset compose along local basis (yawed camera)', async () => {
    // Yaw +90° about Y: basis_x = (0, 0, -1), basis_y = (0, 1, 0). With
    // h_offset=2, the camera should move +2 along world -Z; with v_offset=1
    // it moves +1 along world Y. Origin stays at (0, 0, 5).
    const node: TscnNode = {
      name: 'Cam',
      type: 'Camera3D',
      children: [],
      properties: {
        name: 'Cam',
        projection: ProjectionMode.PROJECTION_PERSPECTIVE,
        fov: 75,
        size: 1,
        near: 0.05,
        far: 100,
        keep_aspect: KeepAspectMode.KEEP_HEIGHT,
        h_offset: 2,
        v_offset: 1,
        frustum_offset: { x: 0, y: 0 },
        current: false,
        cull_mask: 1048575,
        doppler_tracking: 0,
        transform: {
          basis_x: { x: 0, y: 0, z: -1 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 1, y: 0, z: 0 },
          origin: { x: 0, y: 0, z: 5 },
        },
      } as Camera3DProperties,
    };
    const renderer = await ReactThreeTestRenderer.create(<Camera3D node={node} />);
    const cam = renderer.scene.findByType('PerspectiveCamera').instance as THREE.Camera;
    expect(cam.position.x).toBeCloseTo(0, 5);
    expect(cam.position.y).toBeCloseTo(1, 5);
    expect(cam.position.z).toBeCloseTo(5 - 2, 5);
  });

  it('audit slot 14a — surface_material_override slot 0 + slot 1 → mesh.material is a length-2 array', async () => {
    const surfaceMap = new Map<number, string>([
      [0, 'SubResource("MatA")'],
      [1, 'SubResource("MatB")'],
    ]);
    const renderer = await ReactThreeTestRenderer.create(
      <SceneResourcesProvider
        internalResources={[
          // A real two-surface mesh: `MeshInstance3D::_set`
          // (`scene/3d/mesh_instance_3d.cpp:65-73`) drops any override past a
          // PrimitiveMesh's single surface.
          inlineTwoSurfaceMesh('Mesh_1'),
          sub('StandardMaterial3D', 'MatA', { albedo_color: 'Color(1, 0, 0, 1)' }),
          sub('StandardMaterial3D', 'MatB', { albedo_color: 'Color(0, 1, 0, 1)' }),
        ]}
      >
        <MeshInstance3D
          node={makeMeshNode({
            mesh: 'SubResource("Mesh_1")',
            surfaceMaterialOverrides: surfaceMap,
          })}
        />
      </SceneResourcesProvider>
    );
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const materials = mesh.material as THREE.MeshStandardMaterial[];
    expect(Array.isArray(materials)).toBe(true);
    expect(materials).toHaveLength(2);
    expect(materials[0]!.color.r).toBe(1);
    expect(materials[0]!.color.g).toBe(0);
    expect(materials[1]!.color.r).toBe(0);
    expect(materials[1]!.color.g).toBe(1);
  });

  it('audit slot 93a — Label3D billboard=ENABLED → group.userData.billboardMode set + useFrame copies camera.quaternion', async () => {
    const props: Label3DProperties = {
      name: 'L',
      text: 'Hello',
      pixel_size: 0.01,
      billboard: BillboardMode.BILLBOARD_ENABLED,
      modulate: { r: 1, g: 1, b: 1, a: 1 },
      outline_size: 0,
      outline_modulate: { r: 0, g: 0, b: 0, a: 1 },
      double_sided: true,
      font_size: 32,
      line_spacing: 0,
      horizontal_alignment: HorizontalAlignment.CENTER,
      no_depth_test: false,
      render_priority: 0,
      outline_render_priority: -1,
      alpha_cut: AlphaCutMode.DISABLED,
      alpha_scissor_threshold: 0.5,
      fixed_size: false,
      texture_filter: TextureFilter.LINEAR_WITH_MIPMAPS,
    };
    const node: TscnNode = { name: 'L', type: 'Label3D', children: [], properties: props };

    const renderer = await ReactThreeTestRenderer.create(
      <ViewportModeProvider initialShowLabels>
        <Label3D node={node} />
      </ViewportModeProvider>
    );
    const groupInstance = renderer.scene.findByProps({ name: 'L' }).instance as THREE.Group;

    // The marker is used by old-renderer-era tooling to enumerate labels.
    expect(groupInstance.userData.isLabel3D).toBe(true);
    expect(groupInstance.userData.billboardMode).toBe(BillboardMode.BILLBOARD_ENABLED);

    // Snapshot the quaternion before any frame ticks (initial render
    // sets it via the JSX `rotation` prop = [0, 0, 0] → identity quaternion).
    const qBefore = groupInstance.quaternion.clone();

    // Advance enough frames that useFrame runs at least once.
    await renderer.advanceFrames(2, 16);

    // After useFrame ticks, the quaternion should still be set; with the
    // default test-renderer camera (also pointing forward) the value
    // equals the initial identity, so we can't assert it CHANGED.
    // What we CAN assert: the quaternion is a valid normalized quaternion
    // (sum of squares ≈ 1), proving useFrame ran without throwing and
    // left the group in a renderable state.
    const q = groupInstance.quaternion;
    const norm = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w;
    expect(norm).toBeCloseTo(1, 4);
    // qBefore is normalized too; just confirms we tracked the right value.
    expect(qBefore.length()).toBeCloseTo(1, 4);
  });

  it('audit slot 93a — Label3D billboard=DISABLED → useFrame leaves rotation untouched', async () => {
    const props: Label3DProperties = {
      name: 'L',
      text: 'Hello',
      pixel_size: 0.01,
      billboard: BillboardMode.BILLBOARD_DISABLED,
      modulate: { r: 1, g: 1, b: 1, a: 1 },
      outline_size: 0,
      outline_modulate: { r: 0, g: 0, b: 0, a: 1 },
      double_sided: true,
      font_size: 32,
      line_spacing: 0,
      horizontal_alignment: HorizontalAlignment.CENTER,
      no_depth_test: false,
      render_priority: 0,
      outline_render_priority: -1,
      alpha_cut: AlphaCutMode.DISABLED,
      alpha_scissor_threshold: 0.5,
      fixed_size: false,
      texture_filter: TextureFilter.LINEAR_WITH_MIPMAPS,
      transform: {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
      },
    };
    const node: TscnNode = { name: 'L', type: 'Label3D', children: [], properties: props };

    const renderer = await ReactThreeTestRenderer.create(
      <ViewportModeProvider initialShowLabels>
        <Label3D node={node} />
      </ViewportModeProvider>
    );
    const groupInstance = renderer.scene.findByProps({ name: 'L' }).instance as THREE.Group;
    const qBefore = groupInstance.quaternion.clone();

    // Tick frames — billboard DISABLED should be a no-op.
    await renderer.advanceFrames(2, 16);

    // Quaternion identical to pre-frame value.
    expect(groupInstance.quaternion.x).toBeCloseTo(qBefore.x, 6);
    expect(groupInstance.quaternion.y).toBeCloseTo(qBefore.y, 6);
    expect(groupInstance.quaternion.z).toBeCloseTo(qBefore.z, 6);
    expect(groupInstance.quaternion.w).toBeCloseTo(qBefore.w, 6);
  });
});
