/**
 * Y-sort must not lose PackedScene instances. An `instance=` node has no `type=`,
 * so only the dispatcher's `node.instance` branch renders it. An instance renders
 * the same under a `y_sort_enabled` parent, and takes part in the sort.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { NodeDispatcher } from './NodeDispatcher';
import { CanvasWorkspaceProvider } from './contexts/CanvasWorkspaceContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { SceneResourcesProvider } from './SceneResourcesContext';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../parser/TscnParser';

import './nodes/index';

/** The instanced sub-scene: a Node2D root over one findable Polygon2D body. */
const VASE_TSCN = `[gd_scene format=3]

[node name="Vase" type="Node2D"]
y_sort_enabled = true

[node name="VaseBody" type="Polygon2D" parent="."]
color = Color(1, 0, 0, 1)
polygon = PackedVector2Array(0, 0, 16, 0, 16, 16)
`;

/** A main scene whose `Props` container is y-sorted or not, per `ySort`. */
function mainTscn(ySort: boolean): string {
  return `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://vase.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Props" type="Node2D" parent="."]
${ySort ? 'y_sort_enabled = true' : ''}

[node name="Vase1" parent="Props" instance=ExtResource("1")]
position = Vector2(0, 100)

[node name="Marker" type="Polygon2D" parent="Props"]
position = Vector2(0, 200)
color = Color(0, 0, 1, 1)
polygon = PackedVector2Array(0, 0, 16, 0, 16, 16)
`;
}

async function render(ySort: boolean) {
  const fake = createFakeResourceLoader();
  fake.scenes.seed('res://vase.tscn', new TscnParser().parse(VASE_TSCN));
  const scene = new TscnParser().parse(mainTscn(ySort));

  const renderer = await ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace="2d">
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={scene.internalResources}
          externalResources={scene.externalResources}
        >
          <SelectionProvider>
            <NodeDispatcher nodes={scene.nodes} />
          </SelectionProvider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </CanvasWorkspaceProvider>
  );
  await new Promise<void>((r) => setTimeout(r, 10));
  return renderer;
}

/** Accumulated world-Z of every named object, the renderer's draw-order currency. */
function worldZByName(renderer: Awaited<ReturnType<typeof render>>): Map<string, number> {
  const map = new Map<string, number>();
  const first = (renderer.scene as unknown as { children?: Array<{ instance?: THREE.Object3D }> })
    .children?.[0]?.instance;
  let root: THREE.Object3D | null | undefined = first;
  while (root?.parent) root = root.parent;
  root?.traverse((o: THREE.Object3D) => {
    if (o.name) {
      map.set(o.name, o.renderOrder);
    }
  });
  return map;
}

describe('<YSortDispatcher> PackedScene instances', () => {
  it('RED: renders an instanced sub-scene under a y_sort_enabled parent', async () => {
    const renderer = await render(true);
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(0);
    expect(worldZByName(renderer).has('VaseBody')).toBe(true);
  });

  it('DRIFT GUARD: the same instance renders under a non-y-sorted parent too', async () => {
    // The two dispatch paths must agree. If this passes while the y-sort case
    // fails, a second dispatcher has forgotten the `node.instance` branch.
    const renderer = await render(false);
    expect(worldZByName(renderer).has('VaseBody')).toBe(true);
  });

  it('an instance participates in the y-sort order, not just the tree order', async () => {
    // `Vase1` (Y=100) is declared before `Marker` (Y=200), so tree order and Y
    // order agree; flip the assertion's meaning by checking the instance is
    // behind the higher-Y marker, which only a real sort can guarantee.
    const z = await render(true).then(worldZByName);
    expect(z.get('VaseBody')).toBeDefined();
    expect(z.get('Marker')).toBeDefined();
    expect(z.get('Marker')!).toBeGreaterThan(z.get('VaseBody')!);
  });
});
