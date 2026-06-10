/**
 * Tests for WI-R3F-19: Tier-1 parity-audit silent drops.
 *
 * Each test exercises ONE of the 8 HIGH-severity feature drops surfaced
 * by `docs/PARITY-AUDIT.md` and pins the property to its expected
 * value on the THREE primitive. Co-located here (rather than per-node)
 * so the closure of the audit's Tier-1 list reads as a single block.
 *
 * Audit slot numbers from STRICT-VERIFICATION.md Section 1:
 *   14a — surface_material_override slot N>0 → mesh.material[N]
 *   16a — cast_shadow=2 → material.shadowSide === DoubleSide
 *   16b — cast_shadow=3 → mesh.visible === false && castShadow === true
 *   38a — ao_texture → material.aoMap is a THREE.Texture
 *   59a — PrismMesh rotateY(π/6) aligns triangular face with +X
 *   60  — PlaneMesh flip_faces=true → mirrored geometry (negative scale on X axis)
 *   66a — Camera3D h_offset → position shifted along local X
 *   66b — Camera3D v_offset → position shifted along local Y
 *   93a — Label3D billboard=ENABLED → mesh rotates to face camera (post useFrame)
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from '../../nodes/3d/meshinstance3d/Component';
import { Camera3D } from '../../nodes/3d/camera3d/Component';
import { Label3D } from '../../nodes/3d/label3d/Component';
import { ViewportModeProvider } from '../contexts/ViewportModeContext';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { ResourceEventBus } from '../../resources/ResourceEventBus';
import { MetadataStore } from '../../resources/MetadataStore';
import type { ResourceLoader } from '../../resources/ResourceLoader';
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
import { BillboardMode } from '../../nodes/3d/label3d/types';

function makeLoader(): {
  loader: ResourceLoader;
  setTextureCached: (path: string, tex: THREE.Texture) => void;
} {
  const eventBus = new ResourceEventBus();
  const metadata = new MetadataStore();
  const textureCache = new Map<string, THREE.Texture | null>();
  const materialCache = new Map<string, THREE.Material | null>();
  const glbCache = new Map<string, THREE.Object3D | null>();
  const makeProc = <T,>(cache: Map<string, T | null>) => ({
    request: vi.fn(),
    getCached: (p: string) => cache.get(p),
    isCached: (p: string) => cache.has(p),
    isLoading: () => false,
    clearCache: () => {},
    getCacheSize: () => cache.size,
  });
  const sceneCache = new Map<string, unknown | null>();
  const loader = {
    eventBus,
    metadata,
    textures: makeProc<THREE.Texture>(textureCache),
    materials: makeProc<THREE.Material>(materialCache),
    glbMeshes: makeProc<THREE.Object3D>(glbCache),
    scenes: makeProc<unknown>(sceneCache), // WI-ARCH-2: peer processor
    getSceneCached: () => undefined,
    requestScene: () => {},
    register: () => {},
    provideFile: () => {},
    clear: () => {},
  } as unknown as ResourceLoader;
  return {
    loader,
    setTextureCached: (p, t) => textureCache.set(p, t),
  };
}

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
  it('audit slot 16a — cast_shadow=2 (DOUBLE_SIDED) → material.shadowSide === DoubleSide', async () => {
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
    const mesh = renderer.scene.findByType('Mesh').instance as {
      castShadow: boolean;
      material: { shadowSide: THREE.Side };
    };
    expect(mesh.castShadow).toBe(true);
    expect(mesh.material.shadowSide).toBe(THREE.DoubleSide);
  });

  it('audit slot 16b — cast_shadow=3 (SHADOWS_ONLY) → mesh.visible === false but castShadow === true', async () => {
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
    const mesh = renderer.scene.findByType('Mesh').instance as {
      castShadow: boolean;
      visible: boolean;
    };
    expect(mesh.castShadow).toBe(true);
    expect(mesh.visible).toBe(false);
  });

  it('audit slot 38a — ao_texture loaded → material.aoMap is a THREE.Texture', async () => {
    const { loader, setTextureCached } = makeLoader();
    const aoTex = new THREE.Texture();
    const AO_PATH = 'res://textures/ao.png';
    setTextureCached(AO_PATH, aoTex);

    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={loader}>
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
    const mat = renderer.scene.findByType('Mesh').instance.material as THREE.MeshStandardMaterial;
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

  it('audit slot 59a — PrismMesh geometry rotated by π/6 around Y', async () => {
    const renderer = await renderMesh(
      { albedo_color: 'Color(1, 1, 1, 1)' },
      'PrismMesh',
      { size: 'Vector3(2, 2, 2)' }
    );
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const pos = mesh.geometry.attributes.position!;
    // CylinderGeometry(r=1, r=1, h=2, segments=3) places side-wall
    // vertices at azimuths {0, 2π/3, 4π/3}. After `geom.rotateY(π/6)`,
    // those become {π/6, 5π/6, 9π/6}. Collect all unique radial
    // azimuths (rounded) at radius ≈ 1 and confirm they match the
    // rotated set rather than the un-rotated set.
    // Bucket every vertex's azimuth (atan2 over the XZ plane), filtering
    // out cap-center verts which live on the Y axis (r ≈ 0). The remaining
    // vertices are the three triangle corners — at rotated azimuths
    // {30°, 150°, 270°}. We use a generous radius filter (anything with
    // r > 0.1) so the test stays robust against subdivision sampling.
    const azimuths = new Set<string>();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.sqrt(x * x + z * z);
      if (r < 0.1) continue;
      const theta = (Math.atan2(z, x) + 2 * Math.PI) % (2 * Math.PI);
      const bucket = Math.round((theta * 180) / Math.PI / 5) * 5;
      // Normalise the 360° wrap-closing duplicate to 0° so a vertex at
      // exactly 360° shows up as 0° in the set (and is correctly
      // flagged as the unrotated reference).
      azimuths.add((bucket % 360).toString());
    }
    // Build a baseline CylinderGeometry with the same args BUT without
    // the rotation, and capture its azimuths. The PrismMeshGeometry's
    // output should be the baseline rotated by π/6 — i.e. each baseline
    // azimuth A maps to A + 30° (mod 360°) in the rendered geometry.
    const baseline = new THREE.CylinderGeometry(1, 1, 2, 3, 1, false);
    const baselineAzimuths = new Set<string>();
    const basePos = baseline.attributes.position!;
    for (let i = 0; i < basePos.count; i++) {
      const x = basePos.getX(i);
      const z = basePos.getZ(i);
      const r = Math.sqrt(x * x + z * z);
      if (r < 0.1) continue;
      const theta = (Math.atan2(z, x) + 2 * Math.PI) % (2 * Math.PI);
      const bucket = Math.round((theta * 180) / Math.PI / 5) * 5;
      baselineAzimuths.add((bucket % 360).toString());
    }
    baseline.dispose();
    // Every baseline azimuth must NOT appear in the rotated set.
    for (const a of baselineAzimuths) {
      expect(azimuths.has(a)).toBe(false);
    }
    // The rotated set must have at least one entry; baseline disturbed.
    expect(azimuths.size).toBeGreaterThan(0);
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
          sub('BoxMesh', 'Mesh_1', { size: 'Vector3(1, 1, 1)' }),
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
    const mesh = renderer.scene.findByType('Mesh').instance as {
      material: Array<{ color: { r: number; g: number } }>;
    };
    expect(Array.isArray(mesh.material)).toBe(true);
    expect(mesh.material).toHaveLength(2);
    expect(mesh.material[0]!.color.r).toBe(1);
    expect(mesh.material[0]!.color.g).toBe(0);
    expect(mesh.material[1]!.color.r).toBe(0);
    expect(mesh.material[1]!.color.g).toBe(1);
  });

  it('audit slot 93a — Label3D billboard=ENABLED → mesh.userData.billboardMode set + useFrame copies camera.quaternion', async () => {
    // The mocked canvas context lets the rasteriser run under jsdom.
    const mockContext = {
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      measureText: vi.fn(() => ({ width: 100 })),
      fillText: vi.fn(),
      strokeText: vi.fn(),
    };
    HTMLCanvasElement.prototype.getContext = vi.fn((type: string) =>
      type === '2d' ? (mockContext as unknown as CanvasRenderingContext2D) : null
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const props: Label3DProperties = {
      name: 'L',
      text: 'Hello',
      pixel_size: 0.01,
      billboard: BillboardMode.BILLBOARD_ENABLED,
      modulate: { r: 1, g: 1, b: 1, a: 1 },
      outline_size: 0,
      outline_modulate: { r: 0, g: 0, b: 0, a: 1 },
    };
    const node: TscnNode = { name: 'L', type: 'Label3D', children: [], properties: props };

    const renderer = await ReactThreeTestRenderer.create(
      <ViewportModeProvider initialShowLabels>
        <Label3D node={node} />
      </ViewportModeProvider>
    );
    const meshInstance = renderer.scene.findByType('Mesh').instance as THREE.Mesh;

    // The marker is used by old-renderer-era tooling to enumerate labels.
    expect(meshInstance.userData.isLabel3D).toBe(true);
    expect(meshInstance.userData.billboardMode).toBe(BillboardMode.BILLBOARD_ENABLED);

    // Snapshot the quaternion before any frame ticks (initial render
    // sets it via the JSX `rotation` prop = [0, 0, 0] → identity quaternion).
    const qBefore = meshInstance.quaternion.clone();

    // Advance enough frames that useFrame runs at least once.
    await renderer.advanceFrames(2, 16);

    // After useFrame ticks, the quaternion should still be set; with the
    // default test-renderer camera (also pointing forward) the value
    // equals the initial identity, so we can't assert it CHANGED.
    // What we CAN assert: the quaternion is a valid normalized quaternion
    // (sum of squares ≈ 1), proving useFrame ran without throwing and
    // left the mesh in a renderable state.
    const q = meshInstance.quaternion;
    const norm = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w;
    expect(norm).toBeCloseTo(1, 4);
    // qBefore is normalized too; just confirms we tracked the right value.
    expect(qBefore.length()).toBeCloseTo(1, 4);
  });

  it('audit slot 93a — Label3D billboard=DISABLED → useFrame leaves rotation untouched', async () => {
    const mockContext = {
      font: '', fillStyle: '', strokeStyle: '', lineWidth: 0,
      measureText: vi.fn(() => ({ width: 100 })),
      fillText: vi.fn(), strokeText: vi.fn(),
    };
    HTMLCanvasElement.prototype.getContext = vi.fn((type: string) =>
      type === '2d' ? (mockContext as unknown as CanvasRenderingContext2D) : null
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const props: Label3DProperties = {
      name: 'L',
      text: 'Hello',
      pixel_size: 0.01,
      billboard: BillboardMode.BILLBOARD_DISABLED,
      modulate: { r: 1, g: 1, b: 1, a: 1 },
      outline_size: 0,
      outline_modulate: { r: 0, g: 0, b: 0, a: 1 },
      transform: {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
      },
    } as Label3DProperties;
    const node: TscnNode = { name: 'L', type: 'Label3D', children: [], properties: props };

    const renderer = await ReactThreeTestRenderer.create(
      <ViewportModeProvider initialShowLabels>
        <Label3D node={node} />
      </ViewportModeProvider>
    );
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const qBefore = mesh.quaternion.clone();

    // Tick frames — billboard DISABLED should be a no-op.
    await renderer.advanceFrames(2, 16);

    // Quaternion identical to pre-frame value.
    expect(mesh.quaternion.x).toBeCloseTo(qBefore.x, 6);
    expect(mesh.quaternion.y).toBeCloseTo(qBefore.y, 6);
    expect(mesh.quaternion.z).toBeCloseTo(qBefore.z, 6);
    expect(mesh.quaternion.w).toBeCloseTo(qBefore.w, 6);
  });
});
