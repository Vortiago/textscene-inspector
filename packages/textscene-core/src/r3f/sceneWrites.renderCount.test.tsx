import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { openScene } from '../scene/openScene';
import { variant } from '../scene/variant';
import { TscnSceneProvider } from './TscnSceneProvider';
import { TscnSceneContents } from './SceneContents';
import { WrittenWorld2D } from './testing/WrittenWorld2D';
import { Node3D } from '../nodes/base/node3d/Component';
import { Node2D } from '../nodes/base/node2d/Component';
import { Sprite2D } from '../nodes/2d/sprite2d/Component';
import { nodeComponentRegistry, type NodeComponent, type NodeComponentProps } from './NodeComponentRegistry';
import { useNodePath } from './contexts/NodePathContext';
import { settleLoads } from './testing/settleLoads';
import './nodes/index';
import './controls/index';
import { settleLazyImports } from '../testing/lazyImports';

const { sceneRender, walk } = vi.hoisted(() => ({ sceneRender: vi.fn(), walk: vi.fn() }));
vi.mock('./frameProfile/FrameProfiler', async (original) => ({
  ...(await original<typeof import('./frameProfile/FrameProfiler')>()),
  useSceneRenderCount: sceneRender,
}));
vi.mock('./viewStatus/useNoComponentReport', () => ({ useNoComponentReport: walk }));
vi.mock('./world2D/CanvasFrameRender', () => ({ CanvasFrameRender: () => null }));

function siblings(parent: string, type: string) {
  return Array.from({ length: 20 }, (_, i) => `[node name="Leaf${i}" type="${type}" parent="${parent}"]`);
}

function countedComponents() {
  const seen: (string | null)[] = [];
  const get = nodeComponentRegistry.get.bind(nodeComponentRegistry);
  const counted = (render: typeof Node2D) =>
    function CountedNode(props: NodeComponentProps) {
      seen.push(useNodePath());
      return render(props);
    };
  const components = new Map<string, NodeComponent>([
    ['Node3D', counted(Node3D)],
    ['Node2D', counted(Node2D)],
    ['Sprite2D', counted(Sprite2D)],
  ]);
  vi.spyOn(nodeComponentRegistry, 'get').mockImplementation((type) => components.get(type) ?? get(type));
  return seen;
}

afterEach(() => vi.restoreAllMocks());

describe('a host write below a root', () => {
  it('keeps both sprite branches still when the Control walk publishes a new transform', async () => {
    const source = [
      '[gd_scene format=3]',
      '[node name="Root" type="Node2D"]',
      '[node name="Hud" type="ColorRect" parent="."]',
      'offset_right = 50.0',
      'offset_bottom = 50.0',
      ...['Branch', 'Other'].flatMap((parent) => [
        `[node name="${parent}" type="Node2D" parent="."]`,
        ...siblings(parent, 'Sprite2D'),
      ]),
    ].join('\n');
    const scene = openScene({ source, provider: { loadResource: async () => null } });
    const registered = countedComponents();
    const renderer = await ReactThreeTestRenderer.create(
      <TscnSceneProvider scene={scene}>
        <WrittenWorld2D />
      </TscnSceneProvider>
    );
    await ReactThreeTestRenderer.act(settleLazyImports);
    await vi.waitFor(() => expect(renderer.scene.instance.getObjectByName('ColorRect:Hud')).toBeDefined());
    registered.length = 0;
    walk.mockClear();
    sceneRender.mockClear();
    await ReactThreeTestRenderer.act(async () => {
      await scene.getNode('Hud').set('offset_left', 7);
      await settleLoads();
    });
    expect.soft(walk.mock.calls.map(([path]) => path)).toEqual(['Root', 'Root/Hud']);
    expect.soft(registered).toEqual(['Root']);
    expect(sceneRender).not.toHaveBeenCalled();
    await renderer.unmount();
  });

  it.each([
    ['Node3D', 'Node3D', 'Vector3(2, 3, 4)', TscnSceneContents],
    ['Node2D', 'Sprite2D', 'Vector2(2, 3)', WrittenWorld2D],
  ] as const)('walks only the written %s branch', async (base, leaf, position, Contents) => {
    const source = [
      '[gd_scene format=3]',
      `[node name="Root" type="${base}"]`,
      ...['Branch', 'Other'].flatMap((parent) => [
        `[node name="${parent}" type="${base}" parent="."]`,
        ...siblings(parent, leaf),
      ]),
    ].join('\n');
    const scene = openScene({ source, provider: { loadResource: async () => null } });
    await scene.getNode('Other/Leaf1').set('position', variant(position));
    const registered = countedComponents();
    const renderer = await ReactThreeTestRenderer.create(
      <TscnSceneProvider scene={scene}>
        <Contents />
      </TscnSceneProvider>
    );
    await settleLoads();
    expect(new Set(registered).size).toBe(43);
    registered.length = 0;
    walk.mockClear();
    sceneRender.mockClear();
    await ReactThreeTestRenderer.act(async () => {
      await scene.getNode('Branch/Leaf0').set('position', variant(position));
      await settleLoads();
    });
    const paths = ['Root', 'Root/Branch', 'Root/Branch/Leaf0'];
    expect.soft(walk.mock.calls.map(([path]) => path)).toEqual(paths);
    expect.soft(registered).toEqual(paths);
    expect(sceneRender).not.toHaveBeenCalled();
    await renderer.unmount();
  });
});

describe('an instance in the scene walk', () => {
  it.each([
    ['Copy', ['Root', 'Root/Copy']],
    ['Copy/Branch/Leaf0', ['Root', 'Root/Copy', 'Root/Copy/Branch', 'Root/Copy/Branch/Leaf0']],
  ] as const)('walks the branch written at %s', async (path, paths) => {
    const part = [
      '[gd_scene format=3]',
      '[node name="Part" type="Node3D"]',
      '[node name="Branch" type="Node3D" parent="."]',
      ...siblings('Branch', 'Node3D'),
    ].join('\n');
    const scene = openScene({
      source:
        '[gd_scene format=3]\n[ext_resource type="PackedScene" path="res://part.tscn" id="1"]\n' +
        '[node name="Root" type="Node3D"]\n[node name="Copy" parent="." instance=ExtResource("1")]',
      provider: { loadResource: async (file) => (file === 'res://part.tscn' ? part : null) },
    });
    const registered = countedComponents();
    const renderer = await ReactThreeTestRenderer.create(
      <TscnSceneProvider scene={scene}>
        <TscnSceneContents />
      </TscnSceneProvider>
    );
    await vi.waitFor(() => expect(registered).toContain('Root/Copy/Branch/Leaf0'));
    registered.length = 0;
    walk.mockClear();
    sceneRender.mockClear();
    await ReactThreeTestRenderer.act(async () => {
      await scene.getNode(path).set('position', variant('Vector3(1, 2, 3)'));
      await settleLoads();
    });
    expect.soft(walk.mock.calls.map(([walked]) => walked)).toEqual(paths);
    expect.soft(registered).toEqual(paths);
    expect(sceneRender).not.toHaveBeenCalled();
    await renderer.unmount();
  });
});
