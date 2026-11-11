/**
 * Which viewport draws a window when the window above it holds 2D content and Controls. A window
 * that enters the tree under an embedding root embeds only when `force_native` (`window.cpp:1534-1537`),
 * so its authored `gui_embed_subwindows` counts only under a root that embeds none.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { PROJECT_ROOT_EMBEDS_NO_WINDOWS } from '../../../parser/projectSettings.testkit';
import { portalSceneOf } from './viewportPasses.testkit';

import '../../../r3f/nodes/index';
import '../../../r3f/controls/index';

/** A window that authors `gui_embed_subwindows`, with a Control, a 2D item and a window below it. */
const WINDOW_IN_A_WINDOW = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Dialog" type="Window" parent="."]
size = Vector2i(200, 150)
gui_embed_subwindows = true

[node name="Panel" type="ColorRect" parent="Dialog"]
offset_right = 200.0
offset_bottom = 150.0

[node name="Shape" type="Polygon2D" parent="Dialog"]
polygon = PackedVector2Array(0, 0, 100, 0, 100, 100)

[node name="Inner" type="Window" parent="Dialog"]
size = Vector2i(50, 40)

[node name="Fill" type="ColorRect" parent="Dialog/Inner"]
offset_right = 50.0
offset_bottom = 40.0
`;

/** Whether the pass of `Dialog` draws the frame of the window `Inner` over its canvas. */
async function dialogDrawsInner(project: string | null): Promise<boolean> {
  const dialogPass = await portalSceneOf(WINDOW_IN_A_WINDOW, 'Dialog::offscreen', project);
  return dialogPass.getObjectByName('Window:Inner') !== undefined;
}

describe('a window with 2D content and Controls, above another window', () => {
  // The Control painters load lazily; a loaded module lets one settled tick mount them.
  beforeAll(() => import('./ViewportControls'));

  it('leaves the window below to the embedding root of no project, whatever it authors', async () => {
    expect(await dialogDrawsInner(null)).toBe(false);
  });

  it('draws the window below when the root embeds none', async () => {
    expect(await dialogDrawsInner(PROJECT_ROOT_EMBEDS_NO_WINDOWS)).toBe(true);
  });
});
