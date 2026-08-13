/**
 * RED contract — a Control is a CanvasItem, so it paints in TREE ORDER against
 * its Node2D siblings, not above all of them.
 *
 * Godot draws a canvas by appending every visible item to a per-`z_final`
 * linked list during one pre-order walk, then drawing the lists in z order:
 * `_attach_canvas_item_for_draw` (`servers/rendering/renderer_canvas_cull.cpp`
 * lines 274-283) appends to `r_z_list[zidx]`, and `_cull_canvas_item`'s
 * behind/ahead child split (lines 477-490) is the ONLY reordering in the walk.
 * The item's NODE TYPE never enters that decision — a `ColorRect` and a
 * `Sprite2D` at the same `z_final` draw purely in the order the tree visits
 * them. The widespread impression that "UI draws over the world" comes from UI
 * conventionally being authored last, not from a rule.
 *
 * So a background `ColorRect` authored as the FIRST child of a `Node2D` root —
 * how a 2D game backdrop is normally written — must draw UNDERNEATH the
 * sprites that follow it. That is the case these tests pin.
 *
 * ---- The seam -----------------------------------------------------------
 *
 * Paint order in the WebGL canvas is decided by three's transparent-object
 * sort, `reversePainterSortStable`
 * (`three/src/renderers/webgl/WebGLRenderLists.js`), which compares
 * `groupOrder`, then `renderOrder`, then view z DESCENDING (far first), then
 * object id. `groupOrder` is the `renderOrder` of the nearest `Group` ANCESTOR
 * — `projectObject` overwrites it on the way down
 * (`three/src/renderers/WebGLRenderer.js:1838-1840`) — while `renderOrder` is
 * the drawn object's own. Every 2D canvas material here is `transparent` +
 * `depthWrite={false}`, so this comparator alone decides what covers what;
 * nothing is resolved by the depth buffer.
 *
 * These tests therefore observe the composite key three would sort on, for the
 * mesh each node actually draws, and assert the ORDER of those keys. They do
 * not assert any particular encoding: how the key is composed is the
 * implementation's business, and a fix that reorders these two nodes by any
 * means passes.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { NodeDispatcher } from './NodeDispatcher';
import { ControlCanvasLayer } from './controls/native/ControlCanvasLayer';
import { CanvasWorkspaceProvider } from './contexts/CanvasWorkspaceContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { SceneResourcesProvider } from './SceneResourcesContext';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../parser/TscnParser';
import { nearestGroupOrder } from './testing/paintOrder';

import './nodes/index';
import './controls/index';

/**
 * A `Node2D` root holding a full-rect `ColorRect` backdrop and one `Polygon2D`
 * sprite stand-in, in the authored order given. Polygon2D is the world
 * participant because it draws from inline points with no external texture, so
 * the fake loader never decides whether a mesh exists.
 */
function scene(order: 'background-first' | 'background-last'): string {
  const background = `[node name="Background" type="ColorRect" parent="."]
offset_right = 640.0
offset_bottom = 400.0
color = Color(0.141176, 0.152941, 0.164706, 1)
`;
  const sprite = `[node name="Ball" type="Polygon2D" parent="."]
position = Vector2(320, 200)
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)
`;
  return `[gd_scene format=3]

[node name="Root" type="Node2D"]

${order === 'background-first' ? background + '\n' + sprite : sprite + '\n' + background}`;
}

/** Render world content and Controls together, exactly as `World2DContents` mounts them. */
async function renderWorld(tscn: string): Promise<THREE.Object3D | null> {
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const renderer = await ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace="2d">
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={parsed.internalResources}
          externalResources={parsed.externalResources}
        >
          <SelectionProvider>
            <NodeDispatcher nodes={parsed.nodes} />
            <ControlCanvasLayer nodes={parsed.nodes} />
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
  return root ?? null;
}

/**
 * The key three sorts this drawn object by, as a tuple ordered so that
 * lexicographically SMALLER paints FIRST (further back).
 *
 * The third component is the NEGATED world z, because the transparent
 * comparator orders view z descending — far first — and this canvas's ortho
 * camera looks down -Z from z=1000, so a larger world z is nearer and paints
 * later.
 */
function paintKey(object: THREE.Object3D): [number, number, number] {
  const world = new THREE.Vector3();
  object.getWorldPosition(world);
  return [nearestGroupOrder(object), object.renderOrder, -world.z];
}

function compareKeys(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < a.length; i++) {
    const [ai, bi] = [a[i]!, b[i]!];
    if (ai !== bi) return ai - bi;
  }
  return 0;
}

/**
 * The mesh the named node draws its own pixels with.
 *
 * A node's group is named for the node, except that the Control walker
 * qualifies its groups by type (`ColorRect:Background`) — and a Control also
 * leaves an EMPTY placeholder group under its Node2D parent in the world
 * walk, so matching on the name alone can find a group that draws nothing.
 * Both name forms are accepted and the search continues past any group with no
 * mesh in it.
 */
function drawnMeshUnder(root: THREE.Object3D | null, name: string): THREE.Object3D {
  let found: THREE.Object3D | undefined;
  root?.traverse((o) => {
    if (found || (o.name !== name && !o.name.endsWith(`:${name}`))) return;
    o.traverse((d) => {
      if (!found && (d as THREE.Mesh).isMesh) found = d;
    });
  });
  if (!found) throw new Error(`node "${name}" drew no mesh`);
  return found;
}

describe('2D canvas paint order — a Control sorts in tree order with its Node2D siblings', () => {
  it('RED: a ColorRect authored FIRST paints behind a later Polygon2D sibling', async () => {
    const root = await renderWorld(scene('background-first'));
    const background = paintKey(drawnMeshUnder(root, 'Background'));
    const ball = paintKey(drawnMeshUnder(root, 'Ball'));
    // `_attach_canvas_item_for_draw` appended Background first; both sit at
    // z_final 0, so Background is drawn first and the ball covers it.
    expect(compareKeys(background, ball)).toBeLessThan(0);
  });

  it('a ParallaxBackground’s negative layer draws its whole subtree under the world canvas', async () => {
    // `ParallaxBackground extends CanvasLayer` (`scene/2d/parallax_background.h`),
    // so its `layer` names a CANVAS, and a canvas below the world's draws first
    // however late in the tree it sits. Authored LAST here for exactly that
    // reason — under tree order alone it would draw over the ball.
    const root = await renderWorld(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Ball" type="Polygon2D" parent="."]
position = Vector2(320, 200)
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)

[node name="BG" type="ParallaxBackground" parent="."]
layer = -100

[node name="Art" type="Polygon2D" parent="BG"]
polygon = PackedVector2Array(0, 0, 640, 0, 640, 400)
`);
    expect(compareKeys(paintKey(drawnMeshUnder(root, 'Art')), paintKey(drawnMeshUnder(root, 'Ball')))).toBeLessThan(0);
  });

  it('a ColorRect authored LAST paints over an earlier Polygon2D sibling', async () => {
    const root = await renderWorld(scene('background-last'));
    const background = paintKey(drawnMeshUnder(root, 'Background'));
    const ball = paintKey(drawnMeshUnder(root, 'Ball'));
    // The same rule read the other way: tree order alone flips the result, so a
    // fix that simply pushes every Control underneath the world fails here.
    expect(compareKeys(background, ball)).toBeGreaterThan(0);
  });
});
