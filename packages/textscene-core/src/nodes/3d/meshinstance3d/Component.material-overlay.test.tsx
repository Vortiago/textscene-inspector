/**
 * `material_overlay` — a GeometryInstance3D material drawn OVER the surface
 * material rather than instead of it.
 *
 * `_geometry_instance_add_surface`
 * (`servers/rendering/renderer_rd/forward_clustered/render_forward_clustered.cpp:4228-4241`)
 * resolves the surface's own material chain first, and THEN, for the same
 * surface, adds a second one for `material_overlay`:
 *
 *   `_geometry_instance_add_surface_with_material_chain(ginstance, p_surface, material, m_src, p_mesh);`
 *   `if (ginstance->data->material_overlay.is_valid()) { … add it too … }`
 *
 * Two things follow, and they are the ones a "just swap the material" reading
 * gets wrong. It is an EXTRA draw of the same geometry, not a replacement. And
 * it is independent of `material_override`, which was already applied at `:4206`
 * to pick which material the first chain used — so a node carrying both draws
 * the override AND the overlay.
 *
 * The property has been parsed, typed and linted since the slice was written and
 * read by no render site, so it silently did nothing at all.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';

const INTERNALS: TscnInternalResource[] = [
  {
    id: 'Box_1',
    type: 'BoxMesh',
    data: { size: 'Vector3(1, 1, 1)', material: 'SubResource("Mat_mesh")' },
  },
  { id: 'Mat_mesh', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 1, 0, 1)' } },
  { id: 'Mat_node', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 0, 0, 1)' } },
  {
    id: 'Mat_overlay',
    type: 'StandardMaterial3D',
    data: { albedo_color: 'Color(0, 0, 1, 1)', transparency: '1', albedo_color_alpha: '0.5' },
  },
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

async function render(properties: Partial<MeshInstance3DProperties>) {
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={INTERNALS}>
      <MeshInstance3D node={makeNode(properties)} />
    </SceneResourcesProvider>
  );
}

/** Every drawn THREE.Mesh, in scene-graph order. */
function meshes(renderer: Awaited<ReturnType<typeof render>>): THREE.Mesh[] {
  return renderer.scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => m.isMesh);
}

function soleMaterial(mesh: THREE.Mesh): THREE.MeshStandardMaterial {
  const material = Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material;
  return material as THREE.MeshStandardMaterial;
}

/** Which fixture material this is, by its unique albedo channel. */
function which(mesh: THREE.Mesh): 'mesh' | 'node' | 'overlay' {
  const { r, g, b } = soleMaterial(mesh).color;
  if (r > g && r > b) return 'node';
  if (b > r && b > g) return 'overlay';
  void g;
  return 'mesh';
}

describe('MeshInstance3D — material_overlay', () => {
  it('draws nothing extra when the node declares no overlay', async () => {
    expect(meshes(await render({}))).toHaveLength(1);
  });

  it('adds a SECOND draw of the same geometry, keeping the surface material', async () => {
    const drawn = meshes(await render({ materialOverlay: 'SubResource("Mat_overlay")' }));

    expect(drawn).toHaveLength(2);
    // Not a replacement: the surface keeps its own material.
    expect(which(drawn[0]!)).toBe('mesh');
    expect(which(drawn[1]!)).toBe('overlay');
    // The SAME geometry, not a second copy — Godot re-adds the surface it
    // already has rather than building another.
    expect(drawn[1]!.geometry).toBe(drawn[0]!.geometry);
  });

  it('applies alongside material_override, which it does not replace', async () => {
    const drawn = meshes(
      await render({
        materialOverride: 'SubResource("Mat_node")',
        materialOverlay: 'SubResource("Mat_overlay")',
      })
    );

    expect(drawn).toHaveLength(2);
    expect(which(drawn[0]!)).toBe('node');
    expect(which(drawn[1]!)).toBe('overlay');
  });

  it('draws the overlay after the surface, whichever pass they land in', async () => {
    const drawn = meshes(await render({ materialOverlay: 'SubResource("Mat_overlay")' }));

    // Explicit rather than left to three's sort tie-breaks: the transparent list
    // falls back to object id and the opaque list to material id, and both are
    // creation order — which a re-parse can invert by remounting one material
    // and not the other, silently swapping the overlay under its own surface.
    expect(drawn[1]!.renderOrder).toBeGreaterThan(drawn[0]!.renderOrder);
  });

  it('leaves shadow casting to the surface it covers', async () => {
    const drawn = meshes(await render({ materialOverlay: 'SubResource("Mat_overlay")' }));

    // `cast_shadow` is a property of the INSTANCE, not of a surface
    // (`GeometryInstance3D`), so the overlay must not cast one of its own — the
    // geometry is identical, so a second caster is redundant work that can only
    // differ by acne. It still RECEIVES, because Godot lights it like any surface.
    expect(drawn[1]!.castShadow).toBe(false);
    expect(drawn[1]!.receiveShadow).toBe(true);
  });
});
