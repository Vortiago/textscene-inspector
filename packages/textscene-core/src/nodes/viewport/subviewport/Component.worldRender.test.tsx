import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../../../parser/TscnParser';
import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import {
  ViewportPassOrchestrator,
  ViewportPassProvider,
} from '../../../r3f/contexts/ViewportPassRegistryContext';
import { ViewportTextureProvider } from '../../../r3f/contexts/ViewportTextureContext';
import { renderUnderWay, type WorldRender } from '../../../r3f/viewportRender/worldRender';
import { CaptureRenderer } from '../../../r3f/testing/CaptureRenderer';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { fireSceneRender } from '../../../r3f/testing/fireSceneRender';
import { withStubbedGl } from '../../../r3f/testing/stubbedGl';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';

import '../../../r3f/nodes/index';

const scene = (type: 'Node3D' | 'Node2D', viewportProps: string) => `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Viewport" type="SubViewport" parent="."]
render_target_update_mode = 4
own_world_3d = true
${viewportProps}
${type === 'Node3D' ? '\n[node name="Camera3D" type="Camera3D" parent="Viewport"]\n' : ''}
[node name="Item" type="${type}" parent="Viewport"]
`;

/** The render under way at each render of the viewport's own scene in the next frame. */
async function rendersUnderWay(source: string): Promise<(WorldRender | null)[]> {
  const parsed = new TscnParser().parse(source);
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack loader={createFakeResourceLoader().loader} scene={parsed} workspace="3d">
      <ViewportTextureProvider>
        <ViewportPassProvider>
          <NodeDispatcher nodes={parsed.nodes} />
          <CaptureRenderer captured={captured} />
          <ViewportPassOrchestrator />
        </ViewportPassProvider>
      </ViewportTextureProvider>
    </SceneStack>
  );
  const seen: (WorldRender | null)[] = [];
  await withStubbedGl(
    captured.current!,
    {
      onRender: (_, renderedScene, camera) => {
        fireSceneRender(renderedScene, camera);
        if (renderedScene.name === 'Viewport::offscreen') seen.push(renderUnderWay());
      },
    },
    () => renderer.advanceFrames(1, 16)
  );
  return seen;
}

describe('<SubViewport> world draw', () => {
  it("draws its 3D world as its own render: the node's facts, its atlas and the game's rules", async () => {
    const [render] = await rendersUnderWay(
      scene('Node3D', 'msaa_3d = 2\npositional_shadow_atlas_size = 1024')
    );

    expect(render).toMatchObject({
      viewport: { msaa3D: 2, camera: 'elected', drawsEditorChrome: false, previewsEnvironment: false },
      hasCanvasTransform: false,
    });
    expect(render?.shadowAtlas).not.toBeNull();
  });

  it('draws a 2D viewport through its canvas transform', async () => {
    const renders = await rendersUnderWay(scene('Node2D', ''));

    expect(renders.length).toBeGreaterThan(0);
    expect(renders.every((render) => render?.hasCanvasTransform === true)).toBe(true);
  });
});
