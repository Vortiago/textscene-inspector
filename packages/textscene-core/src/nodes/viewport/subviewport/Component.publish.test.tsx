/**
 * `<SubViewport>` as the offscreen publisher. The pass renders the scene the
 * subtree is mounted in: the main scene for a shared world, since
 * `Viewport::find_world_3d` falls through to the parent, or else a detached portal
 * scene. One mount either way, since two `registerNodeObject` calls at one path collide.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

import type { ReactNode } from 'react';
import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../../../parser/TscnParser';
import {
  ViewportTextureProvider,
  useViewportTexture,
  type ViewportTextureEntry,
} from '../../../r3f/contexts/ViewportTextureContext';
import {
  ViewportPassProvider,
  ViewportPassOrchestrator,
} from '../../../r3f/contexts/ViewportPassRegistryContext';
import { SubViewport } from './Component';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { splitSunOf } from '../../../r3f/directionalShadow/splitSun';

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

/** Captures the canvas renderer so a test can observe the offscreen pass. */
function GlSpy({ captured }: { captured: { current: THREE.WebGLRenderer | null } }) {
  captured.current = useThree((state) => state.gl);
  return null;
}

/**
 * Runs one frame with the renderer's target and render entry points stubbed. The
 * fake WebGL context's `setRenderTarget` throws "invalid value used as weak map key"
 * as an unhandled rejection, and nothing here asserts pixels, so a recorder
 * replaces the GL side and the frame exercises only the state around it.
 */
async function advanceFrameWithStubbedGl(
  renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>,
  gl: THREE.WebGLRenderer,
  onBind?: (target: THREE.WebGLRenderTarget | null) => void
): Promise<void> {
  const originalSet = gl.setRenderTarget;
  const originalRender = gl.render;
  gl.setRenderTarget = ((target: THREE.WebGLRenderTarget | null) => {
    onBind?.(target);
  }) as typeof gl.setRenderTarget;
  gl.render = (() => undefined) as typeof gl.render;
  try {
    await renderer.advanceFrames(1, 16);
  } finally {
    gl.setRenderTarget = originalSet;
    gl.render = originalRender;
  }
}

/**
 * Runs one frame whose renders run only each scene's `onBeforeRender`, as `WebGLRenderer.render`
 * does after it updates the matrices, and answers every scene a pass rendered.
 */
async function scenesRenderedNextFrame(
  renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>,
  gl: THREE.WebGLRenderer
): Promise<THREE.Scene[]> {
  const rendered: THREE.Scene[] = [];
  const originalSet = gl.setRenderTarget;
  const originalRender = gl.render;
  gl.setRenderTarget = (() => undefined) as typeof gl.setRenderTarget;
  gl.render = ((scene: THREE.Scene, camera: THREE.Camera) => {
    rendered.push(scene);
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    (scene.onBeforeRender as (...args: unknown[]) => void).call(scene, gl, scene, camera, null);
  }) as typeof gl.render;
  try {
    await renderer.advanceFrames(1, 16);
  } finally {
    gl.setRenderTarget = originalSet;
    gl.render = originalRender;
  }
  return rendered;
}

/**
 * The `gl.toneMapping` in force when the offscreen pass binds its target next
 * frame, since the scoping must be decided by bind time. Only non-null binds
 * count: the pass's `finally` restores the previous (null) target.
 */
async function toneMappingAtNextBind(
  renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>,
  gl: THREE.WebGLRenderer
): Promise<THREE.ToneMapping | null> {
  let seen: THREE.ToneMapping | null = null;
  await advanceFrameWithStubbedGl(renderer, gl, (target) => {
    if (seen === null && target !== null) seen = gl.toneMapping;
  });
  return seen;
}

async function renderScene(source: string, workspace: '2d' | '3d' = '3d', viewportPath = 'Root/Viewport') {
  const parsed = new TscnParser().parse(source);
  const fake = createFakeResourceLoader();
  const seen: (ViewportTextureEntry | null)[] = [];
  const capturedGl: { current: THREE.WebGLRenderer | null } = { current: null };
  const wrap = (nodes: ReactNode) => (
    <SceneStack workspace={workspace} loader={fake.loader} scene={parsed}>
      <ViewportTextureProvider>
        <ViewportPassProvider>
          {nodes}
          <Probe path={viewportPath} seen={seen} />
          <GlSpy captured={capturedGl} />
          <ViewportPassOrchestrator />
        </ViewportPassProvider>
      </ViewportTextureProvider>
    </SceneStack>
  );
  const renderer = await ReactThreeTestRenderer.create(wrap(<NodeDispatcher nodes={parsed.nodes} />));
  return {
    renderer,
    gl: () => capturedGl.current!,
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
   * `Vector2i(512, 512)`), and every consumer lays its surface out against it:
   * a `SubViewportContainer` with `stretch` off draws the sub-viewport's size.
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

  it('unpublishes when the sub-viewport unmounts', async () => {
    const { published, removeScene } = await renderScene(scene3D());
    expect(published()).not.toBeNull();
    await removeScene();
    expect(published()).toBeNull();
  });

  /**
   * `applyProps` stamps `SRGBColorSpace` on any RGBA8/UnsignedByte texture bound to
   * a colour-map prop, and `WebGLRenderer.js` reads an `isXRRenderTarget` pass's
   * output space from that tag, adding an sRGB OETF (1.5-6.5x too bright). The pass
   * re-asserts LINEAR before every bind, so no offscreen render runs under a stamp.
   */
  it('re-asserts the linear storage tag a consumer-side sRGB stamp overwrote', async () => {
    const { renderer, gl, published } = await renderScene(scene3D());
    const texture = published()!.texture;
    expect(texture.colorSpace).toBe(THREE.LinearSRGBColorSpace);
    texture.colorSpace = THREE.SRGBColorSpace;
    await advanceFrameWithStubbedGl(renderer, gl());
    expect(texture.colorSpace).toBe(THREE.LinearSRGBColorSpace);
  });

  /**
   * `find_world_3d` walks up unless `own_world_3d`, so these descendants draw in
   * the parent view, and that inline mount is the render source. The subtree
   * appears exactly once, or `registerNodeObject` collides.
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
   * inline mount there, but a `Sprite2D` in that workspace can consume the
   * ViewportTexture, so the target is still produced. The root is a `Node2D`,
   * since a Node3D root opens in the 3D workspace.
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
   * `_render_buffers_post_process_and_tonemap` (renderer_scene_render_rd.cpp) reads
   * the environment of the viewport's `find_world_3d()`. A shared world resolves to
   * the parent's (`viewport.cpp`), so its curve, the ADR-0025 preview FILMIC here,
   * applies in the target too, and the pass leaves the renderer's tonemap in force.
   */
  it('shared world: the offscreen pass keeps the shared environment tonemap', async () => {
    const { renderer, gl } = await renderScene(scene3D());
    gl().toneMapping = THREE.CustomToneMapping;
    expect(await toneMappingAtNextBind(renderer, gl())).toBe(THREE.CustomToneMapping);
  });

  /**
   * With `own_world_3d`, `find_world_3d()` returns a fresh `World3D` with no
   * Environment, and the default `tonemap_mode` is `0` LINEAR
   * (`doc/classes/Environment.xml`). The renderer's tonemap belongs to the main
   * scene's environment, so the pass suspends it.
   */
  it('own world: the offscreen pass renders without the shared environment tonemap', async () => {
    const { renderer, gl } = await renderScene(scene3D('own_world_3d = true'));
    gl().toneMapping = THREE.CustomToneMapping;
    expect(await toneMappingAtNextBind(renderer, gl())).toBe(THREE.NoToneMapping);
    // Restored after the pass: the main render still owns the live curve.
    expect(gl().toneMapping).toBe(THREE.CustomToneMapping);
  });

  /**
   * An own world's lights reach no render but this pass's, so the pass fits their shadows to
   * its own camera. A DirectionalLight3D draws four splits by default, through a split sun.
   */
  it('own world: fits a shadowed sun inside the sub-viewport to the pass camera', async () => {
    const { renderer, gl } = await renderScene(
      `${scene3D('own_world_3d = true')}
[node name="Sun" type="DirectionalLight3D" parent="Viewport"]
shadow_enabled = true
`
    );
    const portals = await scenesRenderedNextFrame(renderer, gl());
    const suns = portals.flatMap((scene) => scene.getObjectsByProperty('isDirectionalLight', true));
    expect(suns).toHaveLength(1);
    expect(splitSunOf(suns[0] as THREE.DirectionalLight)).not.toBeNull();
  });

  /**
   * Each viewport owns its positional shadow atlas (`renderer_viewport.cpp:961`), and a Viewport's
   * is 2048 texels (`viewport.h:305`): its largest slot is 512, so an omni cube face is 256.
   */
  it('own world: fits a shadowed omni light in the sub-viewport’s own atlas', async () => {
    const { renderer, gl } = await renderScene(`${scene3D('own_world_3d = true')}
[node name="Lamp" type="OmniLight3D" parent="Viewport"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -5)
omni_range = 8.0
shadow_enabled = true
`);
    const portals = await scenesRenderedNextFrame(renderer, gl());
    const [lamp] = portals.flatMap((scene) => scene.getObjectsByProperty('isPointLight', true));
    expect((lamp as THREE.PointLight).shadow.mapSize.x).toBe(256);
  });

  it('own world: reads an authored atlas size (edge case)', async () => {
    const { renderer, gl } =
      await renderScene(`${scene3D('own_world_3d = true\npositional_shadow_atlas_size = 4096')}
[node name="Lamp" type="OmniLight3D" parent="Viewport"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -5)
omni_range = 8.0
shadow_enabled = true
`);
    const portals = await scenesRenderedNextFrame(renderer, gl());
    const [lamp] = portals.flatMap((scene) => scene.getObjectsByProperty('isPointLight', true));
    expect((lamp as THREE.PointLight).shadow.mapSize.x).toBe(512);
  });

  it('own world: an atlas of size zero draws no positional shadow (error case)', async () => {
    const { renderer, gl } =
      await renderScene(`${scene3D('own_world_3d = true\npositional_shadow_atlas_size = 0')}
[node name="Lamp" type="OmniLight3D" parent="Viewport"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -5)
omni_range = 8.0
shadow_enabled = true
`);
    const portals = await scenesRenderedNextFrame(renderer, gl());
    const [lamp] = portals.flatMap((scene) => scene.getObjectsByProperty('isPointLight', true));
    expect((lamp as THREE.PointLight).shadow.intensity).toBe(0);
  });

  it('2D content: hooks no shadow fit on a portal that holds no 3D light (edge case)', async () => {
    const { renderer, gl } = await renderScene(`[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Viewport" type="SubViewport" parent="."]
size = Vector2i(300, 300)

[node name="Inside" type="Sprite2D" parent="Viewport"]
`);
    const [portal] = await scenesRenderedNextFrame(renderer, gl());
    expect(portal!.onBeforeRender).toBe(THREE.Object3D.prototype.onBeforeRender);
  });

  /**
   * Godot never tonemaps a 2D-world canvas: `tonemap.glsl` is a 3D post effect,
   * and canvas items draw into the target after it, in output space. So a
   * 2D-content target inherits no curve.
   */
  it('2D content: the offscreen pass renders without the 3D environment tonemap', async () => {
    const { renderer, gl } = await renderScene(`[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Viewport" type="SubViewport" parent="."]
size = Vector2i(300, 300)

[node name="Inside" type="Sprite2D" parent="Viewport"]
`);
    gl().toneMapping = THREE.CustomToneMapping;
    expect(await toneMappingAtNextBind(renderer, gl())).toBe(THREE.NoToneMapping);
  });

  /**
   * Control content belongs to a different publisher (`ControlRasterPass.tsx`). A
   * cleared target here would race it for the same registry key, so this one
   * publishes nothing.
   */
  it('publishes nothing for a Control-only sub-viewport, leaving the key to the native Control-raster pass', async () => {
    const { published } = await renderScene(`[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Panel" type="ColorRect" parent="Viewport"]
`);
    expect(published()).toBeNull();
  });

  /**
   * `subtreeConformance` requires every component's probe child to survive, since
   * no Godot node type is a leaf. A sub-viewport whose parsed children classify as
   * neither '3d' nor '2d' gets no pass and no portal, so its children pass through inline.
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
   * nothing else. The target is still published, so a consumer can tell an
   * unrendered viewport from a missing one.
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
