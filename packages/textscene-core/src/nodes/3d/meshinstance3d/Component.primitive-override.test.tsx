/**
 * Material precedence on a PRIMITIVE mesh, where the mesh is a `[sub_resource]`
 * of the scene rather than a baked ArrayMesh `.tres`.
 *
 * The order is the same one the ArrayMesh path follows, because it is decided in
 * the renderer and not per mesh type. `_geometry_instance_add_surface`
 * (`servers/rendering/renderer_rd/forward_clustered/render_forward_clustered.cpp:4206`)
 * puts the node-level `material_override` in front of whatever the surface loop
 * resolved, on EVERY surface:
 *   `m_src = material_override.is_valid() ? material_override : p_material;`
 * and the surface loop (`:4264`) had already preferred `inst_materials[j]` —
 * what `surface_material_override/N` writes — over the mesh's own `materials[j]`.
 * `MeshInstance3D::get_active_material` (`scene/3d/mesh_instance_3d.cpp:384`)
 * restates it.
 *
 * So per surface: material_override > surface_material_override/N > mesh-own.
 * Only a node setting BOTH of the top two can tell the difference, which is why
 * ranking them the other way round survived: the far commoner scenes that set
 * exactly one resolve identically under either order.
 *
 * Surface 0 is the whole of it here: a PrimitiveMesh has one surface, so
 * `MeshInstance3D::_set` (`scene/3d/mesh_instance_3d.cpp:65-73`) refuses every
 * higher `surface_material_override/N` against the array `_mesh_changed`
 * (`:407`) sized to `get_surface_count()`. The per-surface half of the same
 * order is asserted on a real multi-surface mesh in
 * `Component.arraymesh-override.test.tsx`.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { findMesh } from '../testing/reactThreeTestInstance';

const INTERNALS: TscnInternalResource[] = [
  { id: 'Box_1', type: 'BoxMesh', data: { size: 'Vector3(1, 1, 1)', material: 'SubResource("Mat_mesh")' } },
  { id: 'Mat_mesh', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 1, 0, 1)' } },
  { id: 'Mat_surface', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 0, 1, 1)' } },
  { id: 'Mat_node', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 0, 0, 1)' } },
];

function makeNode(properties: Partial<MeshInstance3DProperties>): TscnNode {
  const full: MeshInstance3DProperties = {
    name: 'M',
    mesh: 'SubResource("Box_1")',
    surfaceMaterialOverrides: new Map(),
    materialOverride: undefined,
    ...properties,
  };
  return { name: 'M', type: 'MeshInstance3D', children: [], properties: full };
}

async function materialsOf(node: TscnNode): Promise<THREE.MeshStandardMaterial[]> {
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={INTERNALS}>
      <MeshInstance3D node={node} />
    </SceneResourcesProvider>
  );
  const material = findMesh(renderer.scene).material;
  return (Array.isArray(material) ? material : [material]) as THREE.MeshStandardMaterial[];
}

/** Which of the three fixture materials a slot resolved to, by its unique albedo channel. */
function whichMaterial(m: THREE.MeshStandardMaterial): 'node' | 'surface' | 'mesh' {
  const { r, g, b } = m.color;
  if (r > g && r > b) return 'node';
  if (b > r && b > g) return 'surface';
  return 'mesh';
}

describe('<MeshInstance3D> primitive-mesh material precedence', () => {
  it('ranks material_override above surface_material_override/0', async () => {
    const materials = await materialsOf(
      makeNode({
        surfaceMaterialOverrides: new Map([[0, 'SubResource("Mat_surface")']]),
        materialOverride: 'SubResource("Mat_node")',
      })
    );
    expect(whichMaterial(materials[0]!)).toBe('node');
  });

  it('falls back to surface_material_override/N when there is no material_override', async () => {
    const materials = await materialsOf(
      makeNode({ surfaceMaterialOverrides: new Map([[0, 'SubResource("Mat_surface")']]) })
    );
    expect(whichMaterial(materials[0]!)).toBe('surface');
  });

  it('falls back to the mesh’s own material when neither override is set', async () => {
    const materials = await materialsOf(makeNode({}));
    expect(whichMaterial(materials[0]!)).toBe('mesh');
  });

  it('uses material_override alone when no surface override exists', async () => {
    const materials = await materialsOf(makeNode({ materialOverride: 'SubResource("Mat_node")' }));
    expect(whichMaterial(materials[0]!)).toBe('node');
  });
});
