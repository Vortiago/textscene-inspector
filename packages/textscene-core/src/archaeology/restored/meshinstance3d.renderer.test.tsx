/**
 * Archaeology: ported from main:packages/textscene-core/src/nodes/3d/meshinstance3d/renderer.test.ts
 *
 * Original tested `createMeshInstance3D` (deleted) and `applyNode3DTransform` (deleted).
 * Ported to test equivalent behaviour via the <MeshInstance3D> R3F component +
 * SceneResourcesProvider.
 *
 * Key differences from original:
 * - Shadow mode 0 (OFF): original expected castShadow=false, mesh.visible=true.
 *   R3F component uses `visible` prop for shadowsOnly (mode 3), castShadow prop for others.
 * - Material resolution: original used a `mockScene` object with `renderedObject` geometry;
 *   R3F uses `TscnInternalResource` with raw `data` strings parsed at render time.
 * - The "material from mesh" path (mesh has `material` property) is tested via SubResource data.
 * - `applyNode3DTransform` → position/scale applied via the R3F component's transform props.
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from '../../nodes/3d/meshinstance3d/Component';
import { SceneResourcesProvider } from '../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../parser/types';
import type { MeshInstance3DProperties } from '../../nodes/3d/meshinstance3d/types';

function makeNode(properties: Partial<MeshInstance3DProperties> = {}): TscnNode {
  const props: MeshInstance3DProperties = {
    name: properties.name ?? 'TestMesh',
    surfaceMaterialOverrides: properties.surfaceMaterialOverrides ?? new Map(),
    ...properties,
  };
  return {
    name: props.name,
    type: 'MeshInstance3D',
    children: [],
    properties: props,
  };
}

function subResource(
  type: string,
  id: string,
  data: Record<string, string> = {}
): TscnInternalResource {
  return { id, type, data };
}

async function render(
  node: TscnNode,
  internalResources: TscnInternalResource[] = []
) {
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={internalResources}>
      <MeshInstance3D node={node} />
    </SceneResourcesProvider>
  );
}

describe('MeshInstance3D (ported from createMeshInstance3D tests)', () => {
  it('renders a THREE.Mesh', async () => {
    const renderer = await render(makeNode());
    const mesh = renderer.scene.findByType('Mesh');
    expect(mesh).toBeDefined();
  });

  it('sets the mesh name from node name', async () => {
    const renderer = await render(makeNode({ name: 'MyMeshInstance' }));
    const mesh = renderer.scene.findByType('Mesh');
    expect(mesh.instance.name).toBe('MyMeshInstance');
  });

  it('renders placeholder BoxGeometry when no mesh property', async () => {
    const renderer = await render(makeNode());
    const mesh = renderer.scene.findByType('Mesh');
    expect(mesh.instance.geometry.type).toBe('BoxGeometry');
  });

  it('renders wireframe placeholder material', async () => {
    const renderer = await render(makeNode());
    const mesh = renderer.scene.findByType('Mesh');
    const mat = mesh.instance.material as { color: THREE.Color; wireframe: boolean; shadowSide?: number | null };
    expect(mat.wireframe).toBe(true);
    expect(mat.color.getHex()).toBe(0xff00ff);
  });

  it('defaults receiveShadow to true', async () => {
    const renderer = await render(makeNode());
    const mesh = renderer.scene.findByType('Mesh');
    expect(mesh.instance.receiveShadow).toBe(true);
  });
});

describe('Shadow Casting (ported from Shadow Casting describe)', () => {
  it('castShadow=0 (OFF) → mesh.castShadow is false', async () => {
    const renderer = await render(makeNode({ castShadow: 0 }));
    const mesh = renderer.scene.findByType('Mesh');
    expect(mesh.instance.castShadow).toBe(false);
  });

  it('castShadow=1 (ON) → mesh.castShadow is true', async () => {
    const renderer = await render(makeNode({ castShadow: 1 }));
    const mesh = renderer.scene.findByType('Mesh');
    expect(mesh.instance.castShadow).toBe(true);
  });

  it('castShadow=2 (DOUBLE_SIDED) → castShadow=true and material.shadowSide=DoubleSide', async () => {
    // shadowSide is only applied to a real material (not the placeholder).
    // Provide a BoxMesh resource so MaterialSlot is used and shadowSide propagates.
    const resources = [subResource('BoxMesh', 'Box_1')];
    const node = makeNode({ castShadow: 2, mesh: 'SubResource("Box_1")' });
    const renderer = await render(node, resources);
    const mesh = renderer.scene.findByType('Mesh');
    expect(mesh.instance.castShadow).toBe(true);
    // shadowSide=DoubleSide (2) — access via raw property to avoid dual-THREE instanceof
    expect(mesh.instance.material.shadowSide).toBe(2);
  });

  it('castShadow=3 (SHADOWS_ONLY) → castShadow=true and visible=false', async () => {
    const renderer = await render(makeNode({ castShadow: 3 }));
    const mesh = renderer.scene.findByType('Mesh');
    expect(mesh.instance.castShadow).toBe(true);
    expect(mesh.instance.visible).toBe(false);
  });

  it('castShadow undefined → defaults to castShadow=false', async () => {
    const renderer = await render(makeNode());
    const mesh = renderer.scene.findByType('Mesh');
    expect(mesh.instance.castShadow).toBe(false);
  });
});

describe('Integration with Node3D Transform (ported)', () => {
  it('position from Transform3D identity translation', async () => {
    const node = makeNode({
      name: 'TransformMesh',
      transform: {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: 2, y: 3, z: 4 },
      },
    });
    const renderer = await render(node);
    // MeshInstance3D renders directly as <mesh name="TransformMesh" position=...>
    const meshes = renderer.scene.findAllByType('Mesh');
    const named = meshes.find((m) => m.instance.name === 'TransformMesh');
    expect(named).toBeDefined();
    expect(named!.instance.position.x).toBe(2);
    expect(named!.instance.position.y).toBe(3);
    expect(named!.instance.position.z).toBe(4);
  });
});

describe('Material Override (ported from Material Override describe)', () => {
  it('applies materialOverride to mesh', async () => {
    const resources = [
      subResource('BoxMesh', 'BoxMesh_1'),
      subResource('StandardMaterial3D', 'StandardMaterial3D_red', {
        albedo_color: 'Color(1, 0, 0, 1)',
      }),
    ];
    const node = makeNode({
      mesh: 'SubResource("BoxMesh_1")',
      materialOverride: 'SubResource("StandardMaterial3D_red")',
    });
    const renderer = await render(node, resources);
    const mesh = renderer.scene.findByType('Mesh');
    expect(mesh.instance.material.type).toBe('MeshStandardMaterial');
    const mat = mesh.instance.material as { type: string; color: THREE.Color; shadowSide?: number | null };
    expect(mat.color.getHex()).toBe(0xff0000);
  });

  it('applies surface_material_override/0', async () => {
    const resources = [
      subResource('BoxMesh', 'BoxMesh_1'),
      subResource('StandardMaterial3D', 'StandardMaterial3D_blue', {
        albedo_color: 'Color(0, 0, 1, 1)',
      }),
    ];
    const overrides = new Map([[0, 'SubResource("StandardMaterial3D_blue")']]);
    const node = makeNode({
      mesh: 'SubResource("BoxMesh_1")',
      surfaceMaterialOverrides: overrides,
    });
    const renderer = await render(node, resources);
    const mesh = renderer.scene.findByType('Mesh');
    expect(mesh.instance.material.type).toBe('MeshStandardMaterial');
    const mat = mesh.instance.material as { type: string; color: THREE.Color; shadowSide?: number | null };
    expect(mat.color.getHex()).toBe(0x0000ff);
  });

  it('surface_material_override takes precedence over materialOverride', async () => {
    const resources = [
      subResource('BoxMesh', 'BoxMesh_1'),
      subResource('StandardMaterial3D', 'mat_red', { albedo_color: 'Color(1, 0, 0, 1)' }),
      subResource('StandardMaterial3D', 'mat_blue', { albedo_color: 'Color(0, 0, 1, 1)' }),
    ];
    const overrides = new Map([[0, 'SubResource("mat_blue")']]);
    const node = makeNode({
      mesh: 'SubResource("BoxMesh_1")',
      materialOverride: 'SubResource("mat_red")',
      surfaceMaterialOverrides: overrides,
    });
    const renderer = await render(node, resources);
    const mesh = renderer.scene.findByType('Mesh');
    const mat = mesh.instance.material as { type: string; color: THREE.Color; shadowSide?: number | null };
    expect(mat.color.getHex()).toBe(0x0000ff);
  });

  it('uses default material when no overrides and mesh has no material', async () => {
    const resources = [subResource('BoxMesh', 'BoxMesh_1')];
    const node = makeNode({ mesh: 'SubResource("BoxMesh_1")' });
    const renderer = await render(node, resources);
    const mesh = renderer.scene.findByType('Mesh');
    expect(mesh.instance.material.type).toBe('MeshStandardMaterial');
    const mat = mesh.instance.material as { type: string; color: THREE.Color; shadowSide?: number | null };
    expect(mat.color.getHex()).toBe(0xcccccc);
  });

  it('handles missing material reference gracefully (falls back to default)', async () => {
    const resources = [subResource('BoxMesh', 'BoxMesh_1')];
    const node = makeNode({
      mesh: 'SubResource("BoxMesh_1")',
      materialOverride: 'SubResource("NonExistent")',
    });
    const renderer = await render(node, resources);
    const mesh = renderer.scene.findByType('Mesh');
    expect(mesh.instance.material.type).toBe('MeshStandardMaterial');
    const mat = mesh.instance.material as { type: string; color: THREE.Color; shadowSide?: number | null };
    expect(mat.color.getHex()).toBe(0xcccccc);
  });
});

describe('Mesh own material (ported from Mesh Material Support describe)', () => {
  it('uses mesh material when mesh has material property', async () => {
    const resources = [
      subResource('StandardMaterial3D', 'mat_yellow', { albedo_color: 'Color(1, 1, 0, 1)' }),
      subResource('BoxMesh', 'BoxMesh_1', { material: 'SubResource("mat_yellow")' }),
    ];
    const node = makeNode({ mesh: 'SubResource("BoxMesh_1")' });
    const renderer = await render(node, resources);
    const mesh = renderer.scene.findByType('Mesh');
    expect(mesh.instance.material.type).toBe('MeshStandardMaterial');
    const mat = mesh.instance.material as { type: string; color: THREE.Color; shadowSide?: number | null };
    expect(mat.color.getHex()).toBe(0xffff00);
  });

  it('materialOverride takes precedence over mesh material', async () => {
    const resources = [
      subResource('StandardMaterial3D', 'mat_yellow', { albedo_color: 'Color(1, 1, 0, 1)' }),
      subResource('StandardMaterial3D', 'mat_red', { albedo_color: 'Color(1, 0, 0, 1)' }),
      subResource('BoxMesh', 'BoxMesh_1', { material: 'SubResource("mat_yellow")' }),
    ];
    const node = makeNode({
      mesh: 'SubResource("BoxMesh_1")',
      materialOverride: 'SubResource("mat_red")',
    });
    const renderer = await render(node, resources);
    const mesh = renderer.scene.findByType('Mesh');
    const mat = mesh.instance.material as { type: string; color: THREE.Color; shadowSide?: number | null };
    expect(mat.color.getHex()).toBe(0xff0000);
  });

  it('surface_material_override takes precedence over mesh material', async () => {
    const resources = [
      subResource('StandardMaterial3D', 'mat_yellow', { albedo_color: 'Color(1, 1, 0, 1)' }),
      subResource('StandardMaterial3D', 'mat_blue', { albedo_color: 'Color(0, 0, 1, 1)' }),
      subResource('BoxMesh', 'BoxMesh_1', { material: 'SubResource("mat_yellow")' }),
    ];
    const overrides = new Map([[0, 'SubResource("mat_blue")']]);
    const node = makeNode({
      mesh: 'SubResource("BoxMesh_1")',
      surfaceMaterialOverrides: overrides,
    });
    const renderer = await render(node, resources);
    const mesh = renderer.scene.findByType('Mesh');
    const mat = mesh.instance.material as { type: string; color: THREE.Color; shadowSide?: number | null };
    expect(mat.color.getHex()).toBe(0x0000ff);
  });

  it('handles invalid mesh material reference gracefully', async () => {
    const resources = [
      subResource('BoxMesh', 'BoxMesh_1', { material: 'SubResource("NonExistent")' }),
    ];
    const node = makeNode({ mesh: 'SubResource("BoxMesh_1")' });
    const renderer = await render(node, resources);
    const mesh = renderer.scene.findByType('Mesh');
    expect(mesh.instance.material.type).toBe('MeshStandardMaterial');
    const mat = mesh.instance.material as { type: string; color: THREE.Color; shadowSide?: number | null };
    expect(mat.color.getHex()).toBe(0xcccccc);
  });

  it('full precedence: mesh < materialOverride < surface override', async () => {
    const resources = [
      subResource('StandardMaterial3D', 'mat_yellow', { albedo_color: 'Color(1, 1, 0, 1)' }),
      subResource('StandardMaterial3D', 'mat_red', { albedo_color: 'Color(1, 0, 0, 1)' }),
      subResource('StandardMaterial3D', 'mat_blue', { albedo_color: 'Color(0, 0, 1, 1)' }),
      subResource('BoxMesh', 'BoxMesh_1', { material: 'SubResource("mat_yellow")' }),
    ];
    const overrides = new Map([[0, 'SubResource("mat_blue")']]);
    const node = makeNode({
      mesh: 'SubResource("BoxMesh_1")',
      materialOverride: 'SubResource("mat_red")',
      surfaceMaterialOverrides: overrides,
    });
    const renderer = await render(node, resources);
    const mesh = renderer.scene.findByType('Mesh');
    const mat = mesh.instance.material as { type: string; color: THREE.Color; shadowSide?: number | null };
    expect(mat.color.getHex()).toBe(0x0000ff);
  });
});
