/**
 * A SubViewport clears its target by `render_target_clear_mode` (`renderer_viewport.cpp:373-378`).
 * A canvas pass that does not clear draws over the bytes of the render before. A 3D pass repaints
 * its whole target, over opaque black where no clear ever set the colour (`renderer_scene_render_rd.cpp:1464-1469`).
 */
import { describe, expect, it } from 'vitest';
import { framesOf, type PassDraw } from './viewportPasses.testkit';

import '../../../r3f/nodes/index';
import '../../../r3f/controls/index';

const CANVAS_VIEWPORT = (clearMode: number) => `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="View" type="SubViewport" parent="."]
size = Vector2i(32, 32)
render_target_update_mode = 4
render_target_clear_mode = ${clearMode}

[node name="Shape" type="Polygon2D" parent="View"]
color = Color(1, 0, 0, 0.25)
polygon = PackedVector2Array(0, 0, 16, 0, 16, 32)
`;

const WORLD_VIEWPORT = (clearMode: number) => `[gd_scene format=3]

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[node name="Root" type="Node2D"]

[node name="View" type="SubViewport" parent="."]
own_world_3d = true
size = Vector2i(32, 32)
render_target_update_mode = 4
render_target_clear_mode = ${clearMode}

[node name="Camera3D" type="Camera3D" parent="View"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 3)
current = true

[node name="Box" type="MeshInstance3D" parent="View"]
mesh = SubResource("BoxMesh_1")
`;

const EMPTY_VIEWPORT = (clearMode: number) => `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="View" type="SubViewport" parent="."]
size = Vector2i(32, 32)
render_target_update_mode = 4
render_target_clear_mode = ${clearMode}
`;

const isViewportDraw = (draw: PassDraw) => /^View::(offscreen|control-raster)$/.test(draw.scene.name);

/** The draw into the `View` pass in each frame. */
async function viewDrawsByFrame(tscn: string, frames: number): Promise<PassDraw[]> {
  const perFrame = await framesOf(tscn, frames);
  return perFrame.map((draws) =>
    draws.find((draw) => /^View::(offscreen|control-raster)$/.test(draw.scene.name))!
  );
}

const ALWAYS = 0;
const NEVER = 1;
const ONCE = 2;

describe('a canvas SubViewport and its clear mode', () => {
  it('clears the colour on every render under ALWAYS', async () => {
    const draws = await viewDrawsByFrame(CANVAS_VIEWPORT(ALWAYS), 3);
    expect(draws.map((draw) => draw.clearsColor)).toEqual([true, true, true]);
  });

  it('clears no colour under NEVER, so the canvas draws over the target', async () => {
    const draws = await viewDrawsByFrame(CANVAS_VIEWPORT(NEVER), 3);
    expect(draws.map((draw) => draw.clearsColor)).toEqual([false, false, false]);
  });

  it('clears the first render only under ONCE', async () => {
    const draws = await viewDrawsByFrame(CANVAS_VIEWPORT(ONCE), 3);
    expect(draws.map((draw) => draw.clearsColor)).toEqual([true, false, false]);
  });
});

describe('a SubViewport with no content and its clear mode', () => {
  it('draws its target as the project clear colour under ALWAYS', async () => {
    const draws = await viewDrawsByFrame(EMPTY_VIEWPORT(ALWAYS), 2);
    expect(draws.map((draw) => [draw.clearsColor, draw.clearColor])).toEqual([
      [true, '4d4d4d'],
      [true, '4d4d4d'],
    ]);
  });

  it('clears no colour under NEVER', async () => {
    const draws = await viewDrawsByFrame(EMPTY_VIEWPORT(NEVER), 2);
    expect(draws.map((draw) => draw.clearsColor)).toEqual([false, false]);
  });

  it('clears the first render only under ONCE', async () => {
    const draws = await viewDrawsByFrame(EMPTY_VIEWPORT(ONCE), 2);
    expect(draws.map((draw) => draw.clearsColor)).toEqual([true, false]);
  });
});

/** A stretched container hands its viewport the rect after its layout, so no render may come before. */
describe('a stretched SubViewport and its clear mode', () => {
  const STRETCHED = (viewportBody: string) => `[gd_scene format=3]

[node name="Root" type="Control"]

[node name="Container" type="SubViewportContainer" parent="."]
offset_right = 200.0
offset_bottom = 120.0
stretch = true
stretch_shrink = 2

[node name="View" type="SubViewport" parent="Container"]
size = Vector2i(2, 2)
render_target_clear_mode = ${ONCE}
${viewportBody}`;

  const FILL_BODIES = [
    ['no content', ''],
    ['a Control', '\n[node name="Fill" type="ColorRect" parent="Container/View"]'],
    [
      'a Polygon2D',
      '\n[node name="Fill" type="Polygon2D" parent="Container/View"]\npolygon = PackedVector2Array(0, 0, 8, 0, 8, 8)',
    ],
  ] as const;

  it.each(FILL_BODIES)(
    'renders nothing before the container forces its rect, with %s',
    async (_content, body) => {
      const perFrame = await framesOf(STRETCHED(body), 2);
      expect(perFrame.flat().filter(isViewportDraw)).toEqual([]);
    }
  );

  it.each(FILL_BODIES)(
    'renders its first frame at the forced size and clears it, with %s',
    async (_content, body) => {
      const perFrame = await framesOf(STRETCHED(body), 3, (frame, { publishViewportRect }) => {
        if (frame === 1) publishViewportRect('Root/Container/View', { x: 100, y: 60 });
      });
      const draws = perFrame.map((frameDraws) => frameDraws.find(isViewportDraw));
      expect(draws.map((draw) => draw && [draw.bound?.width, draw.bound?.height, draw.clearsColor])).toEqual([
        undefined,
        [100, 60, true],
        [100, 60, false],
      ]);
    }
  );
});

describe('a 3D SubViewport and its clear mode', () => {
  const PROJECT_CLEAR = '4d4d4d';
  const BLACK = '000000';

  it('paints the project clear colour under ALWAYS', async () => {
    const [draw] = await viewDrawsByFrame(WORLD_VIEWPORT(ALWAYS), 1);
    expect(draw!.clearColor).toBe(PROJECT_CLEAR);
  });

  it('paints opaque black under NEVER, as no clear ever set the colour', async () => {
    const draws = await viewDrawsByFrame(WORLD_VIEWPORT(NEVER), 2);
    expect(draws.map((draw) => draw.clearColor)).toEqual([BLACK, BLACK]);
  });

  it('keeps the colour of the one clear under ONCE', async () => {
    const draws = await viewDrawsByFrame(WORLD_VIEWPORT(ONCE), 2);
    expect(draws.map((draw) => draw.clearColor)).toEqual([PROJECT_CLEAR, PROJECT_CLEAR]);
  });
});
