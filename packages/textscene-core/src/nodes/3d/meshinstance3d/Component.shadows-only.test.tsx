/**
 * `cast_shadow = SHADOWS_ONLY` (3) hides the mesh, not its shadow and not its
 * descendants (class_geometryinstance3d.html). `visible = false` would skip the
 * shadow pass and the subtree in `WebGLShadowMap.renderObject`, so each colour
 * draw writes neither colour nor depth instead, with the surface's own material.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { drawsColour } from '../../../r3f/testing/threePasses';
import { CHILD_NAME, childIsRendered, meshInstanceNode } from './testing/renderMeshInstance';
import { findMesh } from '../testing/reactThreeTestInstance';

const BOX: TscnInternalResource = {
  id: 'Box_1',
  type: 'BoxMesh',
  data: { size: 'Vector3(1, 1, 1)' },
};

async function render(properties: Partial<MeshInstance3DProperties>) {
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={[BOX]} externalResources={[]}>
      <MeshInstance3D node={meshInstanceNode({ mesh: 'SubResource("Box_1")' }, properties)}>
        <group name={CHILD_NAME} />
      </MeshInstance3D>
    </SceneResourcesProvider>
  );
}

describe('<MeshInstance3D> cast_shadow = SHADOWS_ONLY', () => {
  it('keeps the object visible so three still walks it for the shadow pass', async () => {
    expect(findMesh((await render({ castShadow: 3 })).scene).visible).toBe(true);
  });

  it('still casts', async () => {
    expect(findMesh((await render({ castShadow: 3 })).scene).castShadow).toBe(true);
  });

  it('writes neither colour nor depth, so the mesh itself draws nothing', async () => {
    const mesh = findMesh((await render({ castShadow: 3 })).scene);
    expect(drawsColour(mesh)).toBe(false);
  });

  it('keeps the surface material attached, so the shadow pass reads its blend mode', async () => {
    const mesh = findMesh((await render({ castShadow: 3 })).scene);
    const material = mesh.material as THREE.Material;
    expect(material.colorWrite).toBe(true);
    expect(material.depthWrite).toBe(true);
  });

  it('renders the nodes parented under it', async () => {
    expect(childIsRendered(await render({ castShadow: 3 }))).toBe(true);
  });

  it('leaves an ordinary mesh drawing normally', async () => {
    const mesh = findMesh((await render({ castShadow: 1 })).scene);
    expect(drawsColour(mesh)).toBe(true);
    expect(mesh.visible).toBe(true);
  });

  it('still hides a mesh whose `visible` is false — and its subtree with it', async () => {
    // Godot's visibility is hierarchical (class_node3d.html `is_visible_in_tree`).
    const renderer = await render({ visible: false });
    expect(findMesh(renderer.scene).visible).toBe(false);
    expect(childIsRendered(renderer)).toBe(false);
  });
});
