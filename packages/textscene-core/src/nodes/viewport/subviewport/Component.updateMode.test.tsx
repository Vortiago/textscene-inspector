/**
 * The pass of a SubViewport renders by its `render_target_update_mode` (`renderer_viewport.cpp:769-813`),
 * and a SubViewportContainer parent replaces the mode (`subviewport_container.cpp:116-128`). The
 * expected frames are the ones the Godot 4.6.3 capture shows.
 */
import { describe, expect, it } from 'vitest';
import { framesOf } from './viewportPasses.testkit';

import '../../../r3f/nodes/index';
import '../../../r3f/controls/index';

const SHAPE = 'polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)';

/** The sub-viewports each frame renders, by name, once per pass. */
async function renderedByFrame(tscn: string, frames: number): Promise<string[][]> {
  const perFrame = await framesOf(tscn, frames);
  return perFrame
    .map((draws) => [
      ...new Set(draws.map((draw) => draw.scene.name).filter((name) => name.endsWith('::offscreen'))),
    ])
    .map((names) => names.map((name) => name.replace('::offscreen', '')).sort());
}

const viewport = (name: string, mode: number, parent = '.') => `
[node name="${name}" type="SubViewport" parent="${parent}"]
size = Vector2i(32, 32)
render_target_update_mode = ${mode}

[node name="Shape" type="Polygon2D" parent="${parent === '.' ? name : `${parent}/${name}`}"]
${SHAPE}
`;

describe('SubViewport update mode', () => {
  it('renders DISABLED never, ONCE on frame 1, ALWAYS on every frame', async () => {
    const tscn = `[gd_scene format=3]

[node name="Root" type="Node2D"]
${viewport('Disabled', 0)}${viewport('Once', 1)}${viewport('Always', 4)}`;
    expect(await renderedByFrame(tscn, 3)).toEqual([['Always', 'Once'], ['Always'], ['Always']]);
  });

  it('starts WHEN_VISIBLE one frame after a consumer samples the target, and never without one', async () => {
    const tscn = `[gd_scene format=3]

[sub_resource type="ViewportTexture" id="ViewportTexture_1"]
viewport_path = NodePath("Seen")

[node name="Root" type="Node2D"]
${viewport('Seen', 2)}${viewport('Unseen', 2)}
[node name="Sampler" type="Sprite2D" parent="."]
texture = SubResource("ViewportTexture_1")
`;
    expect(await renderedByFrame(tscn, 3)).toEqual([[], ['Seen'], ['Seen']]);
  });

  it('renders WHEN_PARENT_VISIBLE with its enclosing viewport, and never under a DISABLED one', async () => {
    const tscn = `[gd_scene format=3]

[node name="Root" type="Node2D"]
${viewport('Once', 1)}${viewport('OnceChild', 3, 'Once')}${viewport('Off', 0)}${viewport('OffChild', 3, 'Off')}`;
    expect(await renderedByFrame(tscn, 2)).toEqual([['Once', 'OnceChild'], []]);
  });

  it('stops a WHEN_PARENT_VISIBLE pass under a DISABLED viewport that holds nothing else', async () => {
    const tscn = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Empty" type="SubViewport" parent="."]
render_target_update_mode = 0
${viewport('Child', 3, 'Empty')}`;
    expect(await renderedByFrame(tscn, 2)).toEqual([[], []]);
  });

  it('forces ALWAYS under a visible SubViewportContainer and DISABLED under a hidden one', async () => {
    const tscn = `[gd_scene format=3]

[node name="Root" type="Control"]

[node name="Shown" type="SubViewportContainer" parent="."]
${viewport('InShown', 0, 'Shown')}
[node name="Hidden" type="SubViewportContainer" parent="."]
visible = false
${viewport('InHidden', 4, 'Hidden')}`;
    expect(await renderedByFrame(tscn, 2)).toEqual([['InShown'], ['InShown']]);
  });
});
