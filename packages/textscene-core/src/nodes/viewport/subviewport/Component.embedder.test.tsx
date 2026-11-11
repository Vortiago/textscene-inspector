/**
 * Which viewport draws a window when the window above it holds 2D content and Controls. A window
 * that enters the tree under an embedding root embeds only when `force_native` (`window.cpp:1534-1537`),
 * so its authored `gui_embed_subwindows` counts only under a root that embeds none.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';

import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../../../parser/TscnParser';
import { withProject } from '../../../r3f/testing/ProjectFixture';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { settleLoads } from '../../../r3f/testing/settleLoads';
import { withStubbedGl } from '../../../r3f/testing/stubbedGl';
import { ViewportPassStack } from './viewportPasses.testkit';

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

/** No project: the root window embeds its windows, as Godot does by default. */
const EMBEDDING_ROOT = null;
const ROOT_THAT_EMBEDS_NONE = `[display]

window/subwindows/embed_subwindows=false
`;

/** Whether the pass of `Dialog` draws the frame of the window `Inner` over its canvas. */
async function dialogDrawsInner(project: string | null): Promise<boolean> {
  const parsed = new TscnParser().parse(WINDOW_IN_A_WINDOW);
  const ProjectFixture = withProject(project);
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack workspace="2d" loader={createFakeResourceLoader().loader} scene={parsed}>
      <ProjectFixture>
        <ViewportPassStack captured={captured}>
          <NodeDispatcher nodes={parsed.nodes} />
        </ViewportPassStack>
      </ProjectFixture>
    </SceneStack>
  );
  await settleLoads();
  let dialogPass: THREE.Object3D | undefined;
  await withStubbedGl(
    captured.current!,
    {
      onRender: (_bound, drawn) => {
        if (drawn.name === 'Dialog::offscreen') dialogPass = drawn;
      },
    },
    () => renderer.advanceFrames(1, 16)
  );
  if (!dialogPass) throw new Error('expected a draw of Dialog::offscreen, got none');
  return dialogPass.getObjectByName('Window:Inner') !== undefined;
}

describe('a window with 2D content and Controls, above another window', () => {
  // The Control painters load lazily; a loaded module lets one settled tick mount them.
  beforeAll(() => import('./ViewportControls'));

  it('leaves the window below to the embedding root, whatever it authors', async () => {
    expect(await dialogDrawsInner(EMBEDDING_ROOT)).toBe(false);
  });

  it('draws the window below when the root embeds none', async () => {
    expect(await dialogDrawsInner(ROOT_THAT_EMBEDS_NONE)).toBe(true);
  });
});
