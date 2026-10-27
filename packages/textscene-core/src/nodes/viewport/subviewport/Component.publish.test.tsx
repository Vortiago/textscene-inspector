/**
 * `<SubViewport>` as the offscreen publisher. The pass renders the scene the
 * subtree is mounted in: the main scene for a shared world, since
 * `Viewport::find_world_3d` falls through to the parent, or else a detached portal
 * scene. One mount either way, since two `registerNodeObject` calls at one path collide.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
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
import { installToneMapping } from '../../../resources/environment/toneMapping';
import { ToneMapper } from '../../../godot/rendering/environment/toneMapping.js';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { splitSunOf } from '../../../r3f/directionalShadow/splitSun';

import '../../../r3f/nodes/index';
import { CaptureRenderer } from '../../../r3f/testing/CaptureRenderer';
import { advanceFrameWithStubbedGl, withStubbedGl } from '../../../r3f/testing/stubbedGl';
import { holdsSrgbBytes } from '../../../r3f/srgbByteTextures';
import { instanceAs } from '../../3d/testing/reactThreeTestInstance';
import { fittedAspect } from '../../3d/camera3d/projectionFit';
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

/** A SubViewport with every default and no children, as the conformance guard builds one. */
const bareSubViewport = new TscnParser().parse(
  '[gd_scene format=3]\n\n[node name="Probe" type="SubViewport"]\n'
).nodes[0]!;

/** Reports whatever is published at `path` on every render. */
function Probe({ path, seen }: { path: string; seen: (ViewportTextureEntry | null)[] }) {
  seen.push(useViewportTexture(path));
  return null;
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
  await withStubbedGl(
    gl,
    {
      onRender: (_, scene, camera) => {
        rendered.push(scene as THREE.Scene);
        scene.updateMatrixWorld();
        camera.updateMatrixWorld();
        (scene.onBeforeRender as (...args: unknown[]) => void).call(scene, gl, scene, camera, null);
      },
    },
    () => renderer.advanceFrames(1, 16)
  );
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

async function renderScene(
  source: string,
  workspace: '2d' | '3d' = '3d',
  viewportPath = 'Root/Viewport',
  canvasCamera: ReactNode = null
) {
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
          {canvasCamera}
          <CaptureRenderer captured={capturedGl} />
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

/** Makes the named camera the one the canvas renders through, as "Use This Camera" does. */
function CanvasRendersThrough({ name }: { name: string }) {
  const scene = useThree((state) => state.scene);
  const set = useThree((state) => state.set);
  useEffect(() => {
    const camera = scene.getObjectByName(name) as THREE.PerspectiveCamera | undefined;
    if (camera) set({ camera });
  }, [scene, set, name]);
  return null;
}

/** How many times the pass calls `gl.clear` itself in the next frame, which a render's autoClear never counts. */
async function explicitClearsNextFrame(
  renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>,
  gl: THREE.WebGLRenderer
): Promise<number> {
  const clear = vi.spyOn(gl, 'clear');
  try {
    await advanceFrameWithStubbedGl(renderer, gl);
    return clear.mock.calls.length;
  } finally {
    clear.mockRestore();
  }
}

/** The sub-viewport's Camera3D after two passes, and the aspect each pass last fitted it to. */
async function viewportCameraAfterTwoPasses(canvasCamera: ReactNode = null) {
  const { renderer, gl } = await renderScene(scene3D(), '3d', 'Root/Viewport', canvasCamera);
  await advanceFrameWithStubbedGl(renderer, gl());
  await advanceFrameWithStubbedGl(renderer, gl());
  return instanceAs<THREE.PerspectiveCamera>(renderer.scene.findByProps({ name: 'Camera3D' }));
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

/** A shared-world sub-viewport of 3D content in a 2D scene, which renders through a portal. */
const scene2DWorkspace = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="1"]

[node name="Stage" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]
size = Vector2i(300, 300)

[node name="Inside" type="MeshInstance3D" parent="Viewport"]
mesh = SubResource("1")

[node name="Camera3D" type="Camera3D" parent="Viewport"]
`;

/** A sub-viewport of 2D-world content in a 2D scene. */
const scene2DContent = `[gd_scene format=3]

[node name="Stage" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]
size = Vector2i(64, 64)

[node name="Fill" type="Polygon2D" parent="Viewport"]
polygon = PackedVector2Array(0, 0, 64, 0, 64, 64, 0, 64)
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
    expect(published()?.plain.texture).toBeDefined();
    expect(published()?.plain.texture.isTexture).toBe(true);
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
   * output space from that tag, adding an sRGB OETF (1.5-6.5x too bright). The tag is
   * pinned, so no offscreen render runs under a stamp.
   */
  it('keeps the linear storage tag through a consumer-side sRGB stamp', async () => {
    const { published } = await renderScene(scene3D());
    const texture = published()!.decoding.texture;
    texture.colorSpace = THREE.SRGBColorSpace;
    expect(texture.colorSpace).toBe(THREE.LinearSRGBColorSpace);
  });

  /** Canvas items write sRGB numbers into an `R8G8B8A8_UNORM` target (`renderer_canvas_render_rd.cpp:671,729`). */
  it('stores 2D-world content as sRGB bytes', async () => {
    const { published } = await renderScene(scene2DContent, '2d', 'Stage/Viewport');
    expect(holdsSrgbBytes(published()!.plain.texture)).toBe(true);
  });

  /**
   * A 3D target is SRGB8_ALPHA8, which decodes on sampling. A canvas consumer filters the bytes
   * (`texture_storage.cpp:754`), so it gets a plain copy of them.
   */
  it('publishes 3D content as sRGB bytes in its plain view and the scene storage in its decoding view', async () => {
    const { published } = await renderScene(scene3D());
    const { plain, decoding } = published()!;
    expect(holdsSrgbBytes(plain.texture)).toBe(true);
    expect(decoding.texture.internalFormat).toBe('SRGB8_ALPHA8');
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
    const { renderer, published } = await renderScene(scene2DWorkspace, '2d', 'Stage/Viewport');
    expect(renderer.scene.findAllByProps({ name: 'Inside' })).toHaveLength(0);
    expect(published()).not.toBeNull();
  });

  /** The 2D workspace's portal after one frame, and the version of the mesh material inside it. */
  async function renderedPortal() {
    const { renderer, gl } = await renderScene(scene2DWorkspace, '2d', 'Stage/Viewport');
    const [portal] = await scenesRenderedNextFrame(renderer, gl());
    const material = (portal!.getObjectByName('Inside') as THREE.Mesh).material as THREE.Material;
    return { renderer, gl, material, versionBefore: material.version };
  }

  /**
   * A portal scene is one the root's install never walks, so the pass recompiles it itself when
   * the curve changes: three keys a compiled program on the chunk only when a material is dirty.
   */
  it('2D workspace: recompiles the portal when a new curve installs', async () => {
    const { renderer, gl, material, versionBefore } = await renderedPortal();

    const restore = installToneMapping(gl(), { mode: ToneMapper.FILMIC }, 'material');
    try {
      await scenesRenderedNextFrame(renderer, gl());
      expect(material.version).toBe(versionBefore + 1);
    } finally {
      restore();
    }
  });

  it('2D workspace: leaves the portal compiled while the curve stays the same', async () => {
    const { renderer, gl, material, versionBefore } = await renderedPortal();

    await scenesRenderedNextFrame(renderer, gl());

    expect(material.version).toBe(versionBefore);
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
   * The glow compositor holds `gl.toneMapping` at `NoToneMapping` and tonemaps the main view in
   * its own pass, which never reaches the target. A shared world's curve still applies inside the
   * target, as above.
   */
  it('shared world: the offscreen pass applies the environment curve the compositor suspends', async () => {
    const { renderer, gl } = await renderScene(scene3D());
    const restore = installToneMapping(gl(), { mode: ToneMapper.FILMIC, exposure: 1 }, 'compositor');
    try {
      gl().toneMapping = THREE.NoToneMapping;
      expect(await toneMappingAtNextBind(renderer, gl())).toBe(THREE.CustomToneMapping);
      expect(gl().toneMapping).toBe(THREE.NoToneMapping);
    } finally {
      restore();
    }
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

  // A render clears only while the renderer's autoClear is on, which the tone-map composer turns off.
  it('clears a 3D target by hand, once, before its camera renders', async () => {
    const { renderer, gl } = await renderScene(scene3D());
    expect(await explicitClearsNextFrame(renderer, gl())).toBe(1);
  });

  it('clears a 3D target by hand when no camera renders into it', async () => {
    const { renderer, gl } = await renderScene(`[gd_scene format=3]

[sub_resource type="BoxMesh" id="1"]

[node name="Root" type="Node3D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Inside" type="MeshInstance3D" parent="Viewport"]
mesh = SubResource("1")
`);
    expect(await explicitClearsNextFrame(renderer, gl())).toBe(1);
  });

  it('clears no 2D target by hand, since its frame clears and the copy overwrites', async () => {
    const { renderer, gl, published } = await renderScene(
      `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Inside" type="Polygon2D" parent="Viewport"]
polygon = PackedVector2Array(0, 0, 10, 0, 10, 10)
`,
      '2d'
    );
    expect(published()).not.toBeNull();
    expect(await explicitClearsNextFrame(renderer, gl())).toBe(0);
  });

  it('leaves its own camera fitted to the target, which only the pass renders through', async () => {
    const camera = await viewportCameraAfterTwoPasses();
    expect(fittedAspect(camera)).toBeCloseTo(320 / 240, 6);
  });

  it('gives the canvas its camera back when the canvas renders through it too (edge case)', async () => {
    const camera = await viewportCameraAfterTwoPasses(<CanvasRendersThrough name="Camera3D" />);
    expect(fittedAspect(camera)).not.toBeCloseTo(320 / 240, 6);
  });
});
