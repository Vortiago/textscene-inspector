import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { openScene, type Scene } from '../scene/openScene';
import { variant } from '../scene/variant';
import { TscnSceneProvider } from './TscnSceneProvider';
import { WrittenWorld2D } from './testing/WrittenWorld2D';
import { settleLoads } from './testing/settleLoads';
import './nodes/index';

vi.mock('./world2D/CanvasFrameRender', () => ({ CanvasFrameRender: () => null }));

const source = `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="Parent" type="Node2D" parent="."]
y_sort_enabled = true
[node name="Front" type="Polygon2D" parent="Parent"]
polygon = PackedVector2Array(0, 0, 20, 0, 20, 20)
[node name="Back" type="Polygon2D" parent="Parent"]
position = Vector2(0, 2)
polygon = PackedVector2Array(0, 0, 20, 0, 20, 20)
`;

async function draw(scene: Scene) {
  const renderer = await ReactThreeTestRenderer.create(
    <TscnSceneProvider scene={scene}>
      <WrittenWorld2D />
    </TscnSceneProvider>
  );
  await settleLoads();
  return renderer;
}

function pixelsOf(renderer: Awaited<ReturnType<typeof draw>>) {
  return ['Front', 'Back'].map((name) => {
    const group = renderer.scene.instance.getObjectByName(name)!;
    const mesh = group.getObjectByProperty('isMesh', true);
    if (!(mesh instanceof Mesh) || !(mesh.material instanceof MeshBasicMaterial))
      throw new Error(`expected polygon mesh for ${name}`);
    return {
      position: group.getWorldPosition(new Vector3()).toArray(),
      order: group.renderOrder,
      tint: mesh.material.color.toArray(),
    };
  });
}

describe('a write in the 2D world', () => {
  it.each([
    ['Parent', 'position', variant('Vector2(15, 20)')],
    ['Parent', 'modulate', variant('Color(0.25, 0.5, 1, 1)')],
    ['Parent/Front', 'z_index', 4],
    ['Parent/Front', 'position', variant('Vector2(0, 3)')],
  ] as const)('draws %s.%s as a fresh view does', async (path, property, value) => {
    const scene = openScene({ source, provider: { loadResource: async () => null } });
    const mounted = await draw(scene);
    const before = pixelsOf(mounted);
    await ReactThreeTestRenderer.act(async () => {
      await scene.getNode(path).set(property, value);
      await settleLoads();
    });
    const after = pixelsOf(mounted);
    expect(after).not.toEqual(before);
    const fresh = await draw(scene);
    expect(after).toEqual(pixelsOf(fresh));
    await mounted.unmount();
    await fresh.unmount();
  });
});
