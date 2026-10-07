/**
 * `material_overlay` draws over the surface material, an extra draw of the same
 * geometry (`servers/rendering/renderer_rd/forward_clustered/render_forward_clustered.cpp:4228-4241`).
 * It is independent of `material_override`, applied at `:4206`, so a node with
 * both draws both.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { drawColourGroup, expectSameRotation, TEST_CAMERA } from '../../../r3f/testing/threePasses';
import { YAWED } from './testing/yawedTransform';
import { GEOMETRY_INSTANCE_DEFAULTS } from '../geometryinstance3d/types';

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
    // The same geometry, not a second copy: Godot re-adds the surface it
    // already has.
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

    // Explicit, not left to three's sort tie-breaks: those fall back to object or
    // material id, creation order, which a re-parse can invert by remounting one
    // material and not the other.
    expect(drawn[1]!.renderOrder).toBeGreaterThan(drawn[0]!.renderOrder);
  });

  it('leaves shadow casting to the surface it covers', async () => {
    const drawn = meshes(await render({ materialOverlay: 'SubResource("Mat_overlay")' }));

    // `cast_shadow` belongs to the instance (`GeometryInstance3D`), not a surface,
    // so the overlay casts no shadow of its own: the geometry is identical. It
    // still receives, because Godot lights it like any surface.
    expect(drawn[1]!.castShadow).toBe(false);
    expect(drawn[1]!.receiveShadow).toBe(true);
  });
});

/**
 * The overlay is its own material pass, so its own `billboard_mode` decides
 * whether it turns, whatever the surface under it does.
 */
describe('MeshInstance3D — material_overlay billboard_mode', () => {
  const BILLBOARD_INTERNALS: TscnInternalResource[] = [
    ...INTERNALS,
    { id: 'Mat_facing', type: 'StandardMaterial3D', data: { billboard_mode: '1' } },
  ];
  const camera = TEST_CAMERA;

  async function overlayOf(properties: Partial<MeshInstance3DProperties>): Promise<THREE.Mesh> {
    const renderer = await ReactThreeTestRenderer.create(
      <SceneResourcesProvider internalResources={BILLBOARD_INTERNALS}>
        <MeshInstance3D node={makeNode({ ...properties, transform: YAWED })} />
      </SceneResourcesProvider>
    );
    const [base, overlay] = meshes(renderer);
    base!.updateMatrixWorld(true);
    return overlay!;
  }

  it('turns an overlay whose material billboards', async () => {
    const overlay = await overlayOf({ materialOverlay: 'SubResource("Mat_facing")' });
    const drawn = drawColourGroup(overlay, camera, 0, (s) => s.matrixWorld);
    expectSameRotation(drawn, camera.matrixWorld);
  });

  it('keeps an overlay whose material does not billboard in the node pose', async () => {
    const overlay = await overlayOf({
      materialOverride: 'SubResource("Mat_facing")',
      materialOverlay: 'SubResource("Mat_overlay")',
    });
    const drawn = drawColourGroup(overlay, camera, 0, (s) => s.matrixWorld);
    expect(drawn.equals(overlay.matrixWorld)).toBe(true);
  });
});
