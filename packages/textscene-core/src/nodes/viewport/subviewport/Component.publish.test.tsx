/**
 * `<SubViewport>` as the offscreen PUBLISHER — the other half of the
 * canvas-boundary story pinned in `Component.test.tsx`.
 *
 * The governing rule is one sentence: **the offscreen pass renders the scene
 * the subtree is actually mounted in.** Godot's `Viewport::find_world_3d`
 * falls through to the parent viewport unless `own_world_3d`, so a
 * shared-world sub-viewport's 3D descendants are already in the main scene —
 * that inline mount IS the render source, and the subtree is never mounted a
 * second time. An own-world sub-viewport (and any sub-viewport in the 2D
 * workspace, where 3D content is dropped from the canvas) has no inline mount,
 * so its subtree is portalled into a detached scene which becomes the source.
 *
 * One mount either way. Two would mean two `registerNodeObject` calls at the
 * same path — last writer wins, and selection would resolve to the offscreen
 * copy.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import type { ReactNode } from 'react';
import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { CanvasWorkspaceProvider } from '../../../r3f/contexts/CanvasWorkspaceContext';
import { SelectionProvider } from '../../../r3f/contexts/SelectionContext';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../../../parser/TscnParser';
import {
  ViewportTextureProvider,
  useViewportTexture,
  type ViewportTextureEntry,
} from '../../../r3f/contexts/ViewportTextureContext';
import { SubViewport } from './Component';

import '../../../r3f/nodes/index';

/** A SubViewport with every default and no children, as the conformance guard builds one. */
const bareSubViewport = new TscnParser().parse(
  '[gd_scene format=3]\n\n[node name="Probe" type="SubViewport"]\n'
).nodes[0]!;

/** Reports whatever is published at `path` on every render. */
function Probe({ path, seen }: { path: string; seen: (ViewportTextureEntry | null)[] }) {
  seen.push(useViewportTexture(path));
  return null;
}

async function renderScene(
  source: string,
  workspace: '2d' | '3d' = '3d',
  viewportPath = 'Root/Viewport'
) {
  const parsed = new TscnParser().parse(source);
  const fake = createFakeResourceLoader();
  const seen: (ViewportTextureEntry | null)[] = [];
  const wrap = (nodes: ReactNode) => (
    <CanvasWorkspaceProvider workspace={workspace}>
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={parsed.internalResources}
          externalResources={parsed.externalResources}
        >
          <SelectionProvider>
            <ViewportTextureProvider>
              {nodes}
              <Probe path={viewportPath} seen={seen} />
            </ViewportTextureProvider>
          </SelectionProvider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </CanvasWorkspaceProvider>
  );
  const renderer = await ReactThreeTestRenderer.create(
    wrap(<NodeDispatcher nodes={parsed.nodes} />)
  );
  return {
    renderer,
    published: () => seen.at(-1) ?? null,
    /** Re-render with the scene removed, so the publisher unmounts. */
    removeScene: () => renderer.update(wrap(null)),
  };
}

/** 3D content inside the sub-viewport, with a camera to render it through. */
const scene3D = (viewportProps = '') => `[gd_scene format=3]

[sub_resource type="BoxMesh" id="1"]

[node name="Root" type="Node3D"]

[node name="Viewport" type="SubViewport" parent="."]
size = Vector2i(320, 240)
${viewportProps}

[node name="Inside" type="MeshInstance3D" parent="Viewport"]
mesh = SubResource("1")

[node name="Camera3D" type="Camera3D" parent="Viewport"]
`;

describe('<SubViewport> offscreen publisher', () => {
  it('publishes a target under its own dispatcher-absolute node path', async () => {
    const { published } = await renderScene(scene3D());
    expect(published()).not.toBeNull();
  });

  /**
   * `size` is the render-target rect (`SubViewport.size`, default
   * `Vector2i(512, 512)`), and every consumer lays its surface out against it —
   * a `SubViewportContainer` with `stretch` off draws the sub-viewport's size,
   * not its own.
   */
  it('publishes the authored size, so consumers can lay out against it', async () => {
    const { published } = await renderScene(scene3D());
    expect(published()?.size).toEqual({ x: 320, y: 240 });
  });

  it('publishes a texture consumers can sample', async () => {
    const { published } = await renderScene(scene3D());
    expect(published()?.texture).toBeDefined();
    expect(published()?.texture.isTexture).toBe(true);
  });

  /**
   * `readPixels` must distinguish "not rendered yet" from "rendered empty" —
   * the DOM surface paints nothing on null but would paint black on an empty
   * ImageData. Under the test renderer no frame ever runs, so it stays null.
   */
  it('readPixels returns null before the first offscreen render', async () => {
    const { published } = await renderScene(scene3D());
    expect(published()?.readPixels?.()).toBeNull();
  });

  it('unpublishes when the sub-viewport unmounts', async () => {
    const { published, removeScene } = await renderScene(scene3D());
    expect(published()).not.toBeNull();
    await removeScene();
    expect(published()).toBeNull();
  });

  /**
   * Godot: `find_world_3d` walks up unless `own_world_3d`, so these descendants
   * draw in the parent view — and that inline mount is the render source. The
   * subtree must appear EXACTLY once, or `registerNodeObject` collides.
   */
  it('shared world: the subtree is mounted once, inline, and still publishes', async () => {
    const { renderer, published } = await renderScene(scene3D());
    expect(renderer.scene.findAllByProps({ name: 'Inside' })).toHaveLength(1);
    expect(published()).not.toBeNull();
  });

  /**
   * `own_world_3d` severs the shared world: the subtree leaves the parent view
   * entirely and exists only inside the detached portal scene, which becomes
   * the render source. Publishing must survive that move.
   */
  it('own world: the subtree leaves the parent scene but still publishes', async () => {
    const { renderer, published } = await renderScene(scene3D('own_world_3d = true'));
    expect(renderer.scene.findAllByProps({ name: 'Inside' })).toHaveLength(0);
    expect(published()).not.toBeNull();
  });

  /**
   * The 2D workspace drops 3D content from the canvas, so the subtree has no
   * inline mount there either — but a `Sprite2D` in that same workspace is a
   * ViewportTexture consumer, so the target still has to be produced. This is
   * the whole of `3d_in_2d.tscn`, whose root is a `Node2D` (a Node3D root would
   * open in the 3D workspace, and is itself dropped here).
   */
  it('2D workspace: publishes a target even though 3D content never reaches the canvas', async () => {
    const { renderer, published } = await renderScene(
      `[gd_scene format=3]

[sub_resource type="BoxMesh" id="1"]

[node name="Stage" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]
size = Vector2i(300, 300)

[node name="Inside" type="MeshInstance3D" parent="Viewport"]
mesh = SubResource("1")

[node name="Camera3D" type="Camera3D" parent="Viewport"]
`,
      '2d',
      'Stage/Viewport'
    );
    expect(renderer.scene.findAllByProps({ name: 'Inside' })).toHaveLength(0);
    expect(published()).not.toBeNull();
  });

  /**
   * Control content has no WebGL source at all — it is rasterized from the DOM
   * overlay by a different publisher. Publishing a cleared target here would
   * race that publisher for the same registry key, so this one publishes
   * NOTHING rather than something wrong.
   */
  it('publishes nothing for a Control-only sub-viewport, leaving the key to the DOM rasterizer', async () => {
    const { published } = await renderScene(`[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Panel" type="ColorRect" parent="Viewport"]
`);
    expect(published()).toBeNull();
  });

  /**
   * `subtreeConformance` renders every registered component with a probe child
   * and requires it to survive — in Godot no node type has leaf semantics. A
   * sub-viewport whose PARSED children classify as neither '3d' nor '2d' gets
   * no offscreen pass and therefore no portal, so the children it was handed
   * have nowhere to go unless they keep passing through inline.
   */
  it('renders dispatched children even with no offscreen pass to portal them into', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SubViewport node={bareSubViewport}>
        <group name="__probe__" />
      </SubViewport>
    );
    expect(renderer.scene.findAllByProps({ name: '__probe__' }).length).toBeGreaterThan(0);
  });

  it('publishes nothing for an empty sub-viewport', async () => {
    const { published } = await renderScene(`[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Viewport" type="SubViewport" parent="."]
`);
    expect(published()).toBeNull();
  });

  /**
   * No camera is not an error: Godot renders the viewport's clear colour and
   * nothing else. The target must still be published, or a consumer cannot
   * tell an unrendered viewport from a missing one.
   */
  it('publishes a target for content with no camera', async () => {
    const { published } = await renderScene(`[gd_scene format=3]

[sub_resource type="BoxMesh" id="1"]

[node name="Root" type="Node3D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Inside" type="MeshInstance3D" parent="Viewport"]
mesh = SubResource("1")
`);
    expect(published()).not.toBeNull();
  });
});
