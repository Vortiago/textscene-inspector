/**
 * A Control paints in tree order against its Node2D siblings: a `ColorRect`
 * authored first draws under the sprites after it. Godot appends items by
 * `z_final` (`servers/rendering/renderer_canvas_cull.cpp` lines 274-283), and the
 * behind/ahead split (lines 477-490) is the only reorder. Node type is no factor.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { NodeDispatcher } from './NodeDispatcher';
import { ControlCanvasLayer } from './controls/native/ControlCanvasLayer';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../parser/TscnParser';
import { nearestGroupOrder } from './testing/paintOrder';
import { SceneStack } from './testing/SceneStack';

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
    <SceneStack workspace="2d" loader={fake.loader} scene={parsed}>
      <NodeDispatcher nodes={parsed.nodes} />
      <ControlCanvasLayer nodes={parsed.nodes} />
    </SceneStack>
  );
  await new Promise<void>((r) => setTimeout(r, 10));
  const first = (renderer.scene as unknown as { children?: Array<{ instance?: THREE.Object3D }> })
    .children?.[0]?.instance;
  let root: THREE.Object3D | null | undefined = first;
  while (root?.parent) root = root.parent;
  return root ?? null;
}

/**
 * The key `reversePainterSortStable` (`WebGLRenderLists.js`) sorts by, smallest first:
 * `groupOrder` of the nearest `Group` (`WebGLRenderer.js:1838-1840`), `renderOrder`,
 * and negated world z, since the ortho camera looks down -Z from z=1000. No 2D
 * material writes depth. The tests assert the order of the keys, not their encoding.
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
 * The mesh the named node draws with. The Control walker names its groups by type
 * (`ColorRect:Background`) and leaves an empty placeholder group in the world walk,
 * so both names match and the search passes any group without a mesh.
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
    // so its `layer` names a canvas, and a canvas below the world's draws first.
    // Authored last, since in tree order alone it would draw over the ball.
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

  it('a ParallaxBackground hosts the canvas its CONTROL children draw on too', async () => {
    // `_enter_canvas` stops at `Object::cast_to<CanvasLayer>(n)` (canvas_item.cpp:246-252),
    // and `ParallaxBackground` is one (`parallax_background.h:34`), so a Control under it
    // parents at that canvas on layer -100, as a Node2D does. On the world canvas its
    // root rank would draw it over the ball.
    const root = await renderWorld(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Ball" type="Polygon2D" parent="."]
position = Vector2(320, 200)
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)

[node name="BG" type="ParallaxBackground" parent="."]

[node name="Art" type="ColorRect" parent="BG"]
offset_right = 640.0
offset_bottom = 400.0
color = Color(0.9, 0.2, 0.2, 1)
`);
    expect(compareKeys(paintKey(drawnMeshUnder(root, 'Art')), paintKey(drawnMeshUnder(root, 'Ball')))).toBeLessThan(0);
  });

  it('a canvas item under a plain Node draws over a sibling authored after it', async () => {
    // Its parent is not a CanvasItem, so it parents at the viewport's canvas
    // (canvas_item.cpp:246-267) and draws at its pre-order rank among the roots
    // (canvas_item.cpp:222-232, :453-466, scene_tree.cpp:333-348, node.cpp:2152-2187,
    // renderer_canvas_cull.h:146-151), over everything under the root it hangs under.
    const root = await renderWorld(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Holder" type="Node" parent="."]

[node name="Detached" type="Polygon2D" parent="Holder"]
polygon = PackedVector2Array(0, 0, 640, 0, 640, 400)

[node name="Ball" type="Polygon2D" parent="."]
position = Vector2(320, 200)
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)
`);
    expect(
      compareKeys(paintKey(drawnMeshUnder(root, 'Detached')), paintKey(drawnMeshUnder(root, 'Ball')))
    ).toBeGreaterThan(0);
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
