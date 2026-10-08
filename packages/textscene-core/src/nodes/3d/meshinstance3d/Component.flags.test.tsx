/**
 * MeshInstance3D's structural flags: mesh resolution, material override
 * precedence, visibility and shadow casting.
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { findMesh } from '../testing/reactThreeTestInstance';
import { subResource } from '../../../testing/subResource';
import { GEOMETRY_INSTANCE_DEFAULTS } from '../geometryinstance3d/types';
import './index.r3f';
import { registeredComponent } from '../../../r3f/testing/registeredComponent';

const MeshInstance3D = registeredComponent('MeshInstance3D');

function makeNode(properties: Partial<MeshInstance3DProperties> = {}): TscnNode {
  const props: MeshInstance3DProperties = {
    ...GEOMETRY_INSTANCE_DEFAULTS,
    name: properties.name ?? 'MyMesh',
    surfaceMaterialOverrides: properties.surfaceMaterialOverrides ?? new Map(),
    ...properties,
  };
  return { rawProperties: {}, name: props.name, type: 'MeshInstance3D', children: [], properties: props };
}

async function render(node: TscnNode, internalResources: TscnInternalResource[] = []) {
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={internalResources}>
      <MeshInstance3D node={node} />
    </SceneResourcesProvider>
  );
}

describe('MeshInstance3D flags (assertions 11–17)', () => {
  it('#11 mesh resolves → BufferGeometry present on rendered mesh', async () => {
    const node = makeNode({ mesh: 'SubResource("Box_1")' });
    const renderer = await render(node, [subResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' })]);
    const mesh = findMesh(renderer.scene);
    expect(mesh.geometry).toBeDefined();
    expect(mesh.geometry.type).toBe('BoxGeometry');
  });

  it('#12 material_override replaces the mesh-own material', async () => {
    const node = makeNode({
      mesh: 'SubResource("Box_1")',
      materialOverride: 'SubResource("Override")',
    });
    const renderer = await render(node, [
      subResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)', material: 'SubResource("MeshOwn")' }),
      subResource('StandardMaterial3D', 'MeshOwn', { albedo_color: 'Color(0, 0, 1, 1)' }),
      subResource('StandardMaterial3D', 'Override', { albedo_color: 'Color(1, 0, 0, 1)' }),
    ]);
    const mat = findMesh(renderer.scene).material as unknown as { color: { r: number } };
    expect(mat.color.r).toBe(1); // override (red), not mesh-own (blue)
  });

  it('#13 material_override wins over surface_material_override/0', async () => {
    const surfaceMap = new Map<number, string>([[0, 'SubResource("Surf0")']]);
    const node = makeNode({
      mesh: 'SubResource("Box_1")',
      materialOverride: 'SubResource("Override")',
      surfaceMaterialOverrides: surfaceMap,
    });
    const renderer = await render(node, [
      subResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' }),
      subResource('StandardMaterial3D', 'Override', { albedo_color: 'Color(1, 0, 0, 1)' }),
      subResource('StandardMaterial3D', 'Surf0', { albedo_color: 'Color(0, 1, 0, 1)' }),
    ]);
    const mat = findMesh(renderer.scene).material as unknown as {
      color: { r: number; g: number };
    };
    expect(mat.color.r).toBe(1);
    expect(mat.color.g).toBe(0);
  });

  it('#14 surface_material_override/1 on a one-surface primitive is DROPPED', async () => {
    // `MeshInstance3D::_set` (`scene/3d/mesh_instance_3d.cpp:65-73`) refuses
    // `idx >= surface_override_materials.size()`, which `_mesh_changed` (`:407`)
    // sizes to 1 for a PrimitiveMesh. One material, not a second slot: WebGLRenderer
    // skips a BoxGeometry group whose `material[i]` is undefined.
    const surfaceMap = new Map<number, string>([[1, 'SubResource("Surf1")']]);
    const node = makeNode({
      mesh: 'SubResource("Box_1")',
      surfaceMaterialOverrides: surfaceMap,
    });
    const renderer = await render(node, [
      subResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' }),
      subResource('StandardMaterial3D', 'Surf1', { albedo_color: 'Color(1, 1, 0, 1)' }),
    ]);
    const mesh = findMesh(renderer.scene) as unknown as {
      material: { color: { r: number; g: number; b: number } };
    };
    expect(Array.isArray(mesh.material)).toBe(false);
    // Godot's default material, not the dropped yellow override.
    expect(mesh.material.color.g).not.toBe(1);
  });

  it('#15 visible=false propagates to mesh.visible', async () => {
    const node = makeNode({ name: 'invisible', mesh: 'SubResource("Box_1")' });
    // Node3DProperties has no `visible` field, so it is set on the properties record.
    (node.properties as unknown as { visible: boolean }).visible = false;
    const renderer = await render(node, [subResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' })]);
    const mesh = renderer.scene.findByType('Mesh');
    expect(mesh.instance.visible).toBe(false);
  });

  it('#16 cast_shadow=0 (OFF) → mesh.castShadow === false', async () => {
    const node = makeNode({ mesh: 'SubResource("Box_1")', castShadow: 0 });
    const renderer = await render(node, [subResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' })]);
    expect(renderer.scene.findByType('Mesh').instance.castShadow).toBe(false);
  });

  it('an absent cast_shadow is ON, not OFF — Godot defaults it to 1', async () => {
    // class_geometryinstance3d.html properties table: cast_shadow default 1
    // (SHADOW_CASTING_SETTING_ON), so an absent key casts.
    const node = makeNode({ mesh: 'SubResource("Box_1")' });
    const renderer = await render(node, [subResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' })]);
    expect(renderer.scene.findByType('Mesh').instance.castShadow).toBe(true);
  });

  it('#17 cast_shadow=1 (ON) → mesh.castShadow === true', async () => {
    const node = makeNode({ mesh: 'SubResource("Box_1")', castShadow: 1 });
    const renderer = await render(node, [subResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' })]);
    expect(renderer.scene.findByType('Mesh').instance.castShadow).toBe(true);
  });
});
