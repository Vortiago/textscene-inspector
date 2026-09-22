/**
 * A canvas root draws in CANVAS space, whatever sits above it in the tree.
 *
 * `CanvasItem::get_global_transform` composes only through
 * `get_parent_item()` (`scene/main/canvas_item.cpp:176-193`), and that getter
 * answers nullptr in two cases: the direct parent fails
 * `Object::cast_to<CanvasItem>`, or the item's own `top_level` short-circuits
 * the cast before it runs (`canvas_item.cpp:565-571`). `_enter_canvas` then
 * parents the item at the CanvasLayer's or the viewport's own canvas
 * (`canvas_item.cpp:234-285`), and `_render_canvas_item_tree` culls each such
 * root from the canvas transform with a white modulate and z 0
 * (`servers/rendering/renderer_canvas_cull.cpp:70-83`).
 *
 * So the four things that compose through the parent item all restart here,
 * and the one that does not is VISIBILITY: `_handle_visibility_change` walks
 * the SCENE-tree children and propagates to a top_level child anyway
 * (`canvas_item.cpp:102-108`, "Should the top_levels stop propagation? I think
 * so, but..."). That is why a canvas root stays nested in the rendered tree
 * and cancels its ancestors' transform rather than being lifted out of it.
 *
 * The Control walk has resolved the broken-chain half of this for a while;
 * these are the Node2D world walk's counterparts, plus `top_level`, which
 * neither walk modelled.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { NodeDispatcher } from './NodeDispatcher';
import { CanvasWorkspaceProvider } from './contexts/CanvasWorkspaceContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { SceneResourcesProvider } from './SceneResourcesContext';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../parser/TscnParser';
import { nearestGroupOrder } from './testing/paintOrder';

import './nodes/index';

async function renderWorld(
  tscn: string,
  subScenes: Readonly<Record<string, string>> = {}
): Promise<THREE.Object3D | null> {
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  for (const [path, source] of Object.entries(subScenes)) {
    fake.scenes.seed(path, new TscnParser().parse(source));
  }
  const renderer = await ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace="2d">
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={parsed.internalResources}
          externalResources={parsed.externalResources}
        >
          <SelectionProvider>
            <NodeDispatcher nodes={parsed.nodes} />
          </SelectionProvider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </CanvasWorkspaceProvider>
  );
  await new Promise<void>((r) => setTimeout(r, 10));
  const first = (renderer.scene as unknown as { children?: Array<{ instance?: THREE.Object3D }> })
    .children?.[0]?.instance;
  let root: THREE.Object3D | null | undefined = first;
  while (root?.parent) root = root.parent;
  root?.updateMatrixWorld(true);
  return root ?? null;
}

/** The mesh the named node draws its own pixels with. */
function drawnMeshUnder(root: THREE.Object3D | null, name: string): THREE.Mesh {
  let found: THREE.Mesh | undefined;
  root?.traverse((o) => {
    if (found || o.name !== name) return;
    o.traverse((d) => {
      if (!found && (d as THREE.Mesh).isMesh) found = d as THREE.Mesh;
    });
  });
  if (!found) throw new Error(`node "${name}" drew no mesh`);
  return found;
}

/** The named node's own canvas-item group, in three-space world coordinates. */
function worldOrigin(root: THREE.Object3D | null, name: string): THREE.Vector3 {
  let found: THREE.Object3D | undefined;
  root?.traverse((o) => {
    if (!found && o.name === name) found = o;
  });
  if (!found) throw new Error(`node "${name}" mounted no group`);
  return found.getWorldPosition(new THREE.Vector3());
}

const RECT = 'polygon = PackedVector2Array(0, 0, 160, 0, 160, 80, 0, 80)';

describe('a canvas root draws in canvas space', () => {
  it('drops the transform above a broken CanvasItem chain', async () => {
    const root = await renderWorld(`[gd_scene format=3]

[node name="Root" type="Node2D"]
position = Vector2(300, 200)

[node name="Holder" type="Node" parent="."]

[node name="Detached" type="Polygon2D" parent="Holder"]
${RECT}
`);
    // A plain `Node` fails `Object::cast_to<CanvasItem>`, so `get_global_transform`
    // returns the item's OWN transform and the rect sits at the canvas origin.
    expect(worldOrigin(root, 'Detached').toArray()).toEqual([0, 0, 0]);
  });

  it('drops the transform above a top_level item whose parent IS a CanvasItem', async () => {
    const root = await renderWorld(`[gd_scene format=3]

[node name="Root" type="Node2D"]
position = Vector2(300, 200)

[node name="TopLevel" type="Polygon2D" parent="."]
top_level = true
position = Vector2(40, 10)
${RECT}
`);
    // Godot pixel space is +Y down and three's is +Y up (`node2dTransform.ts`),
    // so the item's own (40, 10) lands at three (40, -10) and nothing of the
    // parent's (300, 200) reaches it.
    expect(worldOrigin(root, 'TopLevel').toArray()).toEqual([40, -10, 0]);
  });

  it('keeps composing a transform through an unbroken CanvasItem chain', async () => {
    const root = await renderWorld(`[gd_scene format=3]

[node name="Root" type="Node2D"]
position = Vector2(300, 200)

[node name="Nested" type="Polygon2D" parent="."]
position = Vector2(0, 120)
${RECT}
`);
    expect(worldOrigin(root, 'Nested').toArray()).toEqual([300, -320, 0]);
  });

  it('cancels nothing under a ParallaxBackground, which cut the chain itself', async () => {
    // `ParallaxBackground extends CanvasLayer` (`scene/2d/parallax_background.h:35`)
    // and its painter writes its own `matrixWorld`, so the ancestors are
    // already gone; a canvas root inside it that cancelled them AGAIN would
    // land at minus the ancestor transform.
    const root = await renderWorld(`[gd_scene format=3]

[node name="Root" type="Node2D"]
position = Vector2(300, 200)

[node name="BG" type="ParallaxBackground" parent="."]

[node name="Art" type="Polygon2D" parent="BG"]
${RECT}
`);
    expect(worldOrigin(root, 'Art').toArray()).toEqual([0, 0, 0]);
  });

  it('keeps a top_level child out of its parent’s y-sort, and in canvas space', async () => {
    // `_collect_ysort_children` walks the RenderingServer's `child_items`
    // (`renderer_canvas_cull.cpp:110-115`), and a top_level item is not among
    // them — `_enter_canvas` parented it at the canvas
    // (`canvas_item.cpp:234-285`). So it is drawn as a canvas root, not as a
    // sorted sibling, and the sort root's transform never reaches it.
    const root = await renderWorld(`[gd_scene format=3]

[node name="Root" type="Node2D"]
position = Vector2(300, 200)
y_sort_enabled = true

[node name="Sorted" type="Polygon2D" parent="."]
position = Vector2(0, 120)
${RECT}

[node name="Floating" type="Polygon2D" parent="."]
top_level = true
${RECT}
`);
    expect(worldOrigin(root, 'Sorted').toArray()).toEqual([300, -320, 0]);
    expect(worldOrigin(root, 'Floating').toArray()).toEqual([0, 0, 0]);
  });

  it('decides on the MERGED type of an instanced sub-scene, not the `Node` the host tree shows', async () => {
    // An `instance=` node with no `type=` parses as `Node`; the sub-scene root
    // it collapses into is what `Object::cast_to<CanvasItem>` would see
    // (ADR-0013's instance root merge), so the cast has to run after the merge.
    const root = await renderWorld(
      `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" uid="uid://x" path="res://enemy.tscn" id="1"]

[node name="Root" type="Node2D"]
position = Vector2(300, 200)

[node name="Holder" type="Node" parent="."]

[node name="Enemy" parent="Holder" instance=ExtResource("1")]
`,
      {
        'res://enemy.tscn': `[gd_scene format=3]

[node name="Enemy" type="Polygon2D"]
${RECT}
`,
      }
    );
    expect(worldOrigin(root, 'Enemy').toArray()).toEqual([0, 0, 0]);
  });

  it('still draws a top_level child of a y-sorted root the canvas never indexed', async () => {
    // `canvasRootRanges` stops at an `instance=` node, whose real parenting the
    // host tree cannot see — so the y-sort pass and the canvas-root pass must
    // agree on the FLAG, not on that map, or the child is neither sorted nor
    // drawn.
    const root = await renderWorld(
      `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" uid="uid://y" path="res://level.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Level" parent="." instance=ExtResource("1")]
`,
      {
        'res://level.tscn': `[gd_scene format=3]

[node name="Level" type="Node2D"]
position = Vector2(300, 200)
y_sort_enabled = true

[node name="Floating" type="Polygon2D" parent="."]
top_level = true
${RECT}
`,
      }
    );
    expect(worldOrigin(root, 'Floating').toArray()).toEqual([0, 0, 0]);
  });

  it('seeds a canvas root with a white modulate rather than its ancestors’ tint', async () => {
    const root = await renderWorld(`[gd_scene format=3]

[node name="Root" type="Node2D"]
modulate = Color(1, 1, 1, 0.5)

[node name="Holder" type="Node" parent="."]

[node name="Detached" type="Polygon2D" parent="Holder"]
${RECT}
`);
    // `_render_canvas_item_tree` culls every canvas root from `Color(1, 1, 1, 1)`
    // (`renderer_canvas_cull.cpp:82`); the ancestor's alpha never reaches it.
    const material = drawnMeshUnder(root, 'Detached').material as THREE.Material;
    expect(material.opacity).toBe(1);
  });

  it('restarts z accumulation at 0 for a canvas root', async () => {
    const root = await renderWorld(`[gd_scene format=3]

[node name="Root" type="Node2D"]
z_index = 5

[node name="Front" type="Polygon2D" parent="."]
${RECT}

[node name="Holder" type="Node" parent="."]

[node name="Detached" type="Polygon2D" parent="Holder"]
${RECT}
`);
    // `p_z = 0` at `renderer_canvas_cull.cpp:82`, so the detached item is at
    // z_final 0 while its authored-earlier sibling inherits the root's 5 — and
    // z DOMINATES the walk's order, so the later node draws first.
    const detached = nearestGroupOrder(drawnMeshUnder(root, 'Detached'));
    const front = nearestGroupOrder(drawnMeshUnder(root, 'Front'));
    expect(detached).toBeLessThan(front);
  });
});
