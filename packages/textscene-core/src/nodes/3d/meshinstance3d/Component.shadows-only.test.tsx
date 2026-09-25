/**
 * `cast_shadow = SHADOWS_ONLY` (3) hides the mesh, not its shadow and not its
 * descendants (class_geometryinstance3d.html). `visible = false` would skip the
 * shadow pass and the subtree in `WebGLShadowMap.renderObject`, so the mesh
 * writes neither colour nor depth instead.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';

const BOX: TscnInternalResource = {
  id: 'Box_1',
  type: 'BoxMesh',
  data: { size: 'Vector3(1, 1, 1)' },
};

function node(overrides: Partial<MeshInstance3DProperties> = {}): TscnNode {
  const properties: MeshInstance3DProperties = {
    name: 'Caster',
    mesh: 'SubResource("Box_1")',
    surfaceMaterialOverrides: new Map(),
    ...overrides,
  };
  return { name: 'Caster', type: 'MeshInstance3D', children: [], properties };
}

async function render(properties: Partial<MeshInstance3DProperties>) {
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={[BOX]} externalResources={[]}>
      <MeshInstance3D node={node(properties)}>
        <group name="__child__" />
      </MeshInstance3D>
    </SceneResourcesProvider>
  );
}

function meshOf(renderer: Awaited<ReturnType<typeof render>>) {
  // Object3D already declares `visible` / `castShadow`.
  return renderer.scene.findByType('Mesh').instance as THREE.Mesh;
}

/**
 * Whether the child would be rendered. three stops at the first
 * `visible === false`, so every ancestor has to be visible too.
 */
function childIsRendered(renderer: Awaited<ReturnType<typeof render>>) {
  const child = renderer.scene
    .findAllByType('Group')
    .map((g) => g.instance as THREE.Object3D)
    .find((g) => g.name === '__child__');
  if (!child) return false;
  for (let o: THREE.Object3D | null = child; o; o = o.parent) {
    if (o.visible === false) return false;
  }
  return true;
}

describe('<MeshInstance3D> cast_shadow = SHADOWS_ONLY', () => {
  it('keeps the object visible so three still walks it for the shadow pass', async () => {
    expect(meshOf(await render({ castShadow: 3 })).visible).toBe(true);
  });

  it('still casts', async () => {
    expect(meshOf(await render({ castShadow: 3 })).castShadow).toBe(true);
  });

  it('writes neither colour nor depth, so the mesh itself draws nothing', async () => {
    const material = meshOf(await render({ castShadow: 3 })).material as THREE.Material;
    expect(material.colorWrite).toBe(false);
    expect(material.depthWrite).toBe(false);
  });

  it('renders the nodes parented under it', async () => {
    expect(childIsRendered(await render({ castShadow: 3 }))).toBe(true);
  });

  it('leaves an ordinary mesh drawing normally', async () => {
    const material = meshOf(await render({ castShadow: 1 })).material as THREE.Material;
    expect(material.colorWrite).toBe(true);
    expect(meshOf(await render({ castShadow: 1 })).visible).toBe(true);
  });

  it('still hides a mesh whose `visible` is false — and its subtree with it', async () => {
    // Godot's visibility is hierarchical (class_node3d.html `is_visible_in_tree`).
    const renderer = await render({ visible: false });
    expect(meshOf(renderer).visible).toBe(false);
    expect(childIsRendered(renderer)).toBe(false);
  });
});
