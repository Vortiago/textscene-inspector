/**
 * Strict-verification harness (group B) — 7 assertions covering
 * MeshInstance3D's structural flags: mesh resolution, material override
 * precedence, visibility, shadow casting.
 *
 * Assertions: 11–17 of `docs/archive/STRICT-VERIFICATION.md`.
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';

function makeNode(properties: Partial<MeshInstance3DProperties> = {}): TscnNode {
  const props: MeshInstance3DProperties = {
    name: properties.name ?? 'MyMesh',
    surfaceMaterialOverrides: properties.surfaceMaterialOverrides ?? new Map(),
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
    const renderer = await render(node, [sub('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' })]);
    const mesh = renderer.scene.findByType('Mesh');
    expect(mesh.instance.geometry).toBeDefined();
    expect(mesh.instance.geometry.type).toBe('BoxGeometry');
  });

  it('#12 material_override replaces the mesh-own material', async () => {
    const node = makeNode({
      mesh: 'SubResource("Box_1")',
      materialOverride: 'SubResource("Override")',
    });
    const renderer = await render(node, [
      sub('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)', material: 'SubResource("MeshOwn")' }),
      sub('StandardMaterial3D', 'MeshOwn', { albedo_color: 'Color(0, 0, 1, 1)' }),
      sub('StandardMaterial3D', 'Override', { albedo_color: 'Color(1, 0, 0, 1)' }),
    ]);
    const mat = renderer.scene.findByType('Mesh').instance.material as { color: { r: number } };
    expect(mat.color.r).toBe(1); // override (red), not mesh-own (blue)
  });

  it('#13 surface_material_override/0 wins over material_override', async () => {
    const surfaceMap = new Map<number, string>([[0, 'SubResource("Surf0")']]);
    const node = makeNode({
      mesh: 'SubResource("Box_1")',
      materialOverride: 'SubResource("Override")',
      surfaceMaterialOverrides: surfaceMap,
    });
    const renderer = await render(node, [
      sub('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' }),
      sub('StandardMaterial3D', 'Override', { albedo_color: 'Color(1, 0, 0, 1)' }),
      sub('StandardMaterial3D', 'Surf0', { albedo_color: 'Color(0, 1, 0, 1)' }),
    ]);
    const mat = renderer.scene.findByType('Mesh').instance.material as {
      color: { r: number; g: number };
    };
    expect(mat.color.r).toBe(0);
    expect(mat.color.g).toBe(1);
  });

  it('#14 surface_material_override/1 with slot 0 absent → slot 1 lands at material index 1', async () => {
    const surfaceMap = new Map<number, string>([[1, 'SubResource("Surf1")']]);
    const node = makeNode({
      mesh: 'SubResource("Box_1")',
      surfaceMaterialOverrides: surfaceMap,
    });
    const renderer = await render(node, [
      sub('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' }),
      sub('StandardMaterial3D', 'Surf1', { albedo_color: 'Color(1, 1, 0, 1)' }),
    ]);
    // Multi-surface fix: mesh.material is an array — slot 0
    // defaults to grey placeholder, slot 1 carries the yellow override.
    // Each surface gets its own material slot in the array, mirroring
    // the pre-migration imperative renderer's `materials[N]` semantics.
    const mesh = renderer.scene.findByType('Mesh').instance as {
      material: Array<{ color: { r: number; g: number; b: number } }>;
    };
    expect(Array.isArray(mesh.material)).toBe(true);
    expect(mesh.material).toHaveLength(2);
    expect(mesh.material[1]!.color.r).toBe(1);
    expect(mesh.material[1]!.color.g).toBe(1);
    expect(mesh.material[1]!.color.b).toBe(0);
  });

  it('#15 visible=false propagates to mesh.visible', async () => {
    const node = makeNode({ name: 'invisible', mesh: 'SubResource("Box_1")' });
    // Node3DProperties has no `visible` field today — set on properties record.
    (node.properties as unknown as { visible: boolean }).visible = false;
    const renderer = await render(node, [sub('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' })]);
    const mesh = renderer.scene.findByType('Mesh');
    expect(mesh.instance.visible).toBe(false);
  });

  it('#16 cast_shadow=0 (OFF) → mesh.castShadow === false', async () => {
    const node = makeNode({ mesh: 'SubResource("Box_1")', castShadow: 0 });
    const renderer = await render(node, [sub('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' })]);
    expect(renderer.scene.findByType('Mesh').instance.castShadow).toBe(false);
  });

  it('an absent cast_shadow is ON, not OFF — Godot defaults it to 1', async () => {
    // class_geometryinstance3d.html properties table: cast_shadow default 1
    // (SHADOW_CASTING_SETTING_ON). Treating undefined as OFF meant no mesh in
    // the corpus cast a shadow unless the scene said so explicitly.
    const node = makeNode({ mesh: 'SubResource("Box_1")' });
    const renderer = await render(node, [sub('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' })]);
    expect(renderer.scene.findByType('Mesh').instance.castShadow).toBe(true);
  });

  it('#17 cast_shadow=1 (ON) → mesh.castShadow === true', async () => {
    const node = makeNode({ mesh: 'SubResource("Box_1")', castShadow: 1 });
    const renderer = await render(node, [sub('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' })]);
    expect(renderer.scene.findByType('Mesh').instance.castShadow).toBe(true);
  });

  it('a blend-mode (additive) material writes no shadow, even with cast_shadow ON', async () => {
    // Godot excludes additive/subtractive/multiply surfaces from the shadow
    // pass — a glow sprite must not drop a solid silhouette.
    const node = makeNode({
      mesh: 'SubResource("Box_1")',
      materialOverride: 'SubResource("Additive")',
      castShadow: 1,
    });
    const renderer = await render(node, [
      sub('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' }),
      sub('StandardMaterial3D', 'Additive', {
        transparency: '1',
        blend_mode: '1',
        shading_mode: '0',
      }),
    ]);
    expect(renderer.scene.findByType('Mesh').instance.castShadow).toBe(false);
  });
});
