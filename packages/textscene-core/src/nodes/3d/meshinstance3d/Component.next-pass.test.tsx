/**
 * A material's `next_pass` chain draws one extra surface per resolved link, in chain
 * order after its base (`render_forward_clustered.cpp:4183-4201`), and an overlay's
 * chain lands after the surface chain (`:4230-4239`). A link that reads the stencil
 * draws nothing here, which requests no stencil buffer, and the walk continues past
 * it; Godot refuses cycles at the setter (`material.cpp:39-42`), so a cyclic file is a
 * hand-written one and draws each material once.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { nextPassRenderOrder } from '../../../r3f/materials/nextPass';
import { GEOMETRY_INSTANCE_DEFAULTS } from '../geometryinstance3d/types';
import './index.r3f';
import { registeredComponent } from '../../../r3f/testing/registeredComponent';

const MeshInstance3D = registeredComponent('MeshInstance3D');

const STENCIL_READ = {
  stencil_mode: '3',
  stencil_flags: '1',
  stencil_compare: '5',
};

const INTERNALS: TscnInternalResource[] = [
  { id: 'Box_1', type: 'BoxMesh', data: { size: 'Vector3(1, 1, 1)', material: 'SubResource("Mat_mesh")' } },
  { id: 'Mat_mesh', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 1, 0, 1)' } },
  // The two link materials, shared by the cases.
  { id: 'Mat_linkBlue', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 0, 1, 1)' } },
  { id: 'Mat_linkYellow', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 1, 0, 1)' } },
  // A chain of two off the surface material.
  {
    id: 'Mat_chain2',
    type: 'StandardMaterial3D',
    data: { albedo_color: 'Color(0, 1, 0, 1)', next_pass: 'SubResource("Mat_linkBlue")' },
  },
  // A chain of three: two passes off the surface.
  {
    id: 'Mat_chain3',
    type: 'StandardMaterial3D',
    data: {
      albedo_color: 'Color(0, 1, 0, 1)',
      next_pass: 'SubResource("Mat_passMid")',
    },
  },
  {
    id: 'Mat_passMid',
    type: 'StandardMaterial3D',
    data: { albedo_color: 'Color(0, 0, 1, 1)', next_pass: 'SubResource("Mat_linkYellow")' },
  },
  // Overrides that carry chains, the overlay and its chain.
  {
    id: 'Mat_node',
    type: 'StandardMaterial3D',
    data: { albedo_color: 'Color(1, 0, 0, 1)', next_pass: 'SubResource("Mat_linkBlue")' },
  },
  {
    id: 'Mat_overlay',
    type: 'StandardMaterial3D',
    data: {
      albedo_color: 'Color(0.9, 0.1, 0.05, 0.55)',
      transparency: '1',
      next_pass: 'SubResource("Mat_linkBlue")',
    },
  },
  // A hand-written cycle through two inline materials.
  {
    id: 'Mat_cycleA',
    type: 'StandardMaterial3D',
    data: { albedo_color: 'Color(1, 0.5, 0, 1)', next_pass: 'SubResource("Mat_cycleB")' },
  },
  {
    id: 'Mat_cycleB',
    type: 'StandardMaterial3D',
    data: { albedo_color: 'Color(1, 0, 1, 1)', next_pass: 'SubResource("Mat_cycleA")' },
  },
  // A stencil-reading link that the chain continues past.
  {
    id: 'Mat_stencilBase',
    type: 'StandardMaterial3D',
    data: { albedo_color: 'Color(0, 1, 0, 1)', next_pass: 'SubResource("Mat_stencilPass")' },
  },
  {
    id: 'Mat_stencilPass',
    type: 'StandardMaterial3D',
    data: { ...STENCIL_READ, albedo_color: 'Color(0, 0, 0, 1)', next_pass: 'SubResource("Mat_linkBlue")' },
  },
  // A base whose link names nothing.
  {
    id: 'Mat_missing',
    type: 'StandardMaterial3D',
    data: { albedo_color: 'Color(0, 1, 0, 1)', next_pass: 'SubResource("Mat_nope")' },
  },
];

function makeNode(properties: Partial<MeshInstance3DProperties>): TscnNode {
  const full: MeshInstance3DProperties = {
    ...GEOMETRY_INSTANCE_DEFAULTS,
    name: 'M',
    mesh: 'SubResource("Box_1")',
    surfaceMaterialOverrides: new Map(),
    materialOverride: undefined,
    ...properties,
  };
  return { rawProperties: {}, name: 'M', type: 'MeshInstance3D', children: [], properties: full };
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

/** Which fixture material this is, by its albedo. */
function which(mesh: THREE.Mesh): string {
  const { r, g, b } = soleMaterial(mesh).color;
  if (r > 0.9 && g > 0.9 && b < 0.1) return 'yellow';
  if (r > 0.9 && b > 0.9 && g < 0.1) return 'magenta';
  if (r > g && b > g) return 'magenta';
  if (r > 0.9 && g > 0.4) return 'orange';
  if (r > g && r > b) return 'red'; // the surface override and the red-tinted overlay alike
  if (b > r && b > g) return 'blue';
  void g;
  return 'mesh'; // green
}

describe('MeshInstance3D — next_pass', () => {
  it('adds no draw for a material with no next_pass', async () => {
    expect(meshes(await render({}))).toHaveLength(1);
  });

  it('draws the base geometry a second time with the link material', async () => {
    const drawn = meshes(await render({ materialOverride: 'SubResource("Mat_chain2")' }));

    expect(drawn).toHaveLength(2);
    expect(which(drawn[0]!)).toBe('mesh');
    expect(which(drawn[1]!)).toBe('blue');
    // Not a second copy: Godot re-adds the surface it already has.
    expect(drawn[1]!.geometry).toBe(drawn[0]!.geometry);
  });

  it('draws a chain of three in link order, each after its base', async () => {
    const drawn = meshes(await render({ materialOverride: 'SubResource("Mat_chain3")' }));

    expect(drawn).toHaveLength(3);
    expect([which(drawn[0]!), which(drawn[1]!), which(drawn[2]!)]).toEqual(['mesh', 'blue', 'yellow']);
    expect(drawn[1]!.geometry).toBe(drawn[0]!.geometry);
    expect(drawn[2]!.geometry).toBe(drawn[0]!.geometry);
    // Each link draws after what it covers, at its own ordinal
    // (`nextPassRenderOrder`), not left to three's tie-breaks.
    expect(drawn[1]!.renderOrder).toBe(nextPassRenderOrder(1));
    expect(drawn[2]!.renderOrder).toBe(nextPassRenderOrder(2));
    expect(drawn[1]!.renderOrder).toBeGreaterThan(drawn[0]!.renderOrder);
    expect(drawn[2]!.renderOrder).toBeGreaterThan(drawn[1]!.renderOrder);
  });

  it('material_override carries its chain, and surface_material_override/0 does', async () => {
    const byOverride = meshes(await render({ materialOverride: 'SubResource("Mat_node")' }));
    expect(byOverride).toHaveLength(2);
    expect(which(byOverride[0]!)).toBe('red');
    expect(which(byOverride[1]!)).toBe('blue');

    const bySurface = meshes(
      await render({
        surfaceMaterialOverrides: new Map([[0, 'SubResource("Mat_chain2")']]),
      })
    );
    expect(bySurface).toHaveLength(2);
    expect(which(bySurface[1]!)).toBe('blue');
  });

  it('draws an overlay chain after the surface, orders ascending', async () => {
    // The overlay's own `next_pass` runs after the overlay draw itself,
    // and the overlay draw runs after the surface's whole chain.
    const drawn = meshes(await render({ materialOverlay: 'SubResource("Mat_overlay")' }));

    expect(drawn).toHaveLength(3);
    expect(drawn[1]!.renderOrder).toBeGreaterThan(drawn[0]!.renderOrder);
    expect(drawn[2]!.renderOrder).toBeGreaterThan(drawn[1]!.renderOrder);
    expect(which(drawn[2]!)).toBe('blue');
  });

  it('draws each material of a hand-written cyclic chain once', async () => {
    const drawn = meshes(await render({ materialOverride: 'SubResource("Mat_cycleA")' }));

    // A draws at 0, B at 1, and A's repeat is cut: no third pass.
    expect(drawn).toHaveLength(2);
    expect(which(drawn[1]!)).toBe('magenta');
  });

  it('draws nothing for a stencil-reading link, and the chain continues past it', async () => {
    // The CUSTOM + READ + NOT_EQUAL outline shape the ragdoll corpus links with:
    // no stencil buffer is requested, so the link draws nothing and the plain
    // link after it draws, consuming both ordinals.
    const drawn = meshes(await render({ materialOverride: 'SubResource("Mat_stencilBase")' }));

    expect(drawn).toHaveLength(2);
    expect(which(drawn[1]!)).toBe('blue');
    expect(drawn[1]!.renderOrder).toBe(nextPassRenderOrder(2));
  });

  it('ends the chain on a missing link material', async () => {
    const drawn = meshes(await render({ materialOverride: 'SubResource("Mat_missing")' }));
    expect(drawn).toHaveLength(1);
  });
});
