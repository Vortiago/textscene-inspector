/**
 * The native (WebGL) render-to-texture publisher for a Control-only
 * sub-viewport (`viewportContentKind === 'dom'`) — the offscreen counterpart
 * of `<SubViewport>`'s own 3D/2D pass (`Component.tsx`), for content that
 * pass deliberately declines.
 *
 * Godot draws a Control-only viewport's canvas straight into its target —
 * there is no separate "Control renderer" in the engine, just the same
 * canvas-item draw calls the on-screen overlay already runs. The previewer's
 * NATIVE Control pipeline (`ControlCanvasWalker`, `r3f/controls/native/`)
 * draws Controls as ordinary three.js objects, so giving a Control-only
 * viewport its own target is the SAME offscreen-portal trick `<SubViewport>`
 * already uses for 3D/2D content — mount the walker into a detached scene,
 * render it through a fixed camera framing the target rect, publish the
 * result. This replaces the previous DOM approach (an off-screen `<div>`
 * rasterised through an SVG `foreignObject` snapshot, `rasterizeControlSubtree`)
 * entirely: every sub-viewport kind now publishes a texture consumers sample
 * directly, with no CPU round trip.
 *
 * COLOUR is the one place this pass is the MIRROR IMAGE of the 3D/2D one, not
 * a copy of it. Godot draws a viewport's canvas items AFTER that viewport's
 * own tonemap pass (`RendererViewport::_draw_viewport` runs `_draw_3d` —
 * ending in `_render_buffers_post_process_and_tonemap` — before its
 * `render_canvas` loop), so a Control target holds POST-tonemap, ordinary
 * sRGB canvas values with no curve of its own; the curve applies exactly
 * ONCE, on whatever surface consumes this target. Measured on
 * `unit-sub-viewport-control-texture.tscn` through Godot 4.6.3: a
 * Color(0.5, 0.5, 0.5) ColorRect reaches the consuming quad as rgb(162), one
 * FILMIC application of the ADR-0025 preview environment; a pre-tonemapped
 * target would land near rgb(196). So this pass forces `NoToneMapping` for
 * its own render (Controls are never tonemapped, on-screen or off) and tags
 * its target `SRGBColorSpace` — no `isXRRenderTarget` — the OPPOSITE of
 * `createOffscreenTarget`'s contract, deliberately: this target's own OETF
 * IS the encode a Control's on-screen quad would have gotten from the
 * renderer's default (sRGB) framebuffer output, and `isXRRenderTarget` is
 * what makes three read a target's output space from the tag at all — the
 * same switch, applied to the opposite starting point.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { createPortal, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// The BARREL, not `ControlCanvasWalker.tsx` directly — its side-effect
// imports are what register every type's `Native` painter (the same barrel
// the on-screen `<ControlCanvasLayer>` lazy-loads). Without it every Control
// in a Control-only sub-viewport would resolve to `<ControlFallback>`'s
// outline, whether or not the on-screen overlay ever mounts one in THIS
// canvas — a 3D-workspace scene with a Control-only sub-viewport and no
// on-screen 2D Controls would otherwise never trigger the registrations at
// all. Callers lazy-load this whole module (mirroring the deleted DOM
// `ControlRasterHost`'s own bundle boundary), so this import costs nothing
// for a scene with no Control-only sub-viewport.
import '../../../r3f/controls/index.js';
import { useRegisterViewportTexture, type ViewportTextureEntry } from '../../../r3f/contexts/ViewportTextureContext.js';
import { useRegisterViewportPass } from '../../../r3f/contexts/ViewportPassRegistryContext.js';
import { useViewportRect } from '../../../r3f/contexts/ViewportRectContext.js';
import { useProjectSettings } from '../../../r3f/contexts/ProjectSettingsContext.js';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext.js';
import { useBuildSolveTree } from '../../../r3f/controls/native/buildSolveTree.js';
import { ControlCanvasWalker } from '../../../r3f/controls/native/ControlCanvasWalker.js';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme.js';
import { measureText } from '../../../r3f/controls/native/text/measurer.js';
import type { Rect2 } from '../../../r3f/controls/native/rect.js';
import { DEFAULT_CLEAR_COLOR, applyOrthoFrame, orthoFrameForSize } from './offscreenViewport.js';
import { collectNestedViewportPaths } from './nestedViewportPaths.js';
import type { ControlRasterViewport } from './controlRasterViewports.js';

export interface ControlRasterPassesProps {
  /** The Control-only sub-viewports found in the scene, each with its own resource scope (ADR-0009). */
  viewports: readonly ControlRasterViewport[];
}

/** One native offscreen pass per Control-only sub-viewport in the scene. */
export function ControlRasterPasses({ viewports }: ControlRasterPassesProps) {
  return (
    <>
      {viewports.map((viewport) => (
        <ControlRasterPass key={viewport.path} viewport={viewport} />
      ))}
    </>
  );
}

function createRasterTarget(width: number, height: number, name: string): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, {
    depthBuffer: true,
    stencilBuffer: false,
  });
  // The opposite tag from `createOffscreenTarget`'s 3D/2D target — see the
  // module doc's COLOUR section for why a Control-only target wants sRGB
  // storage and no `isXRRenderTarget` rather than the linear/XR pair.
  target.texture.colorSpace = THREE.SRGBColorSpace;
  target.texture.name = `${name}::target`;
  target.texture.minFilter = THREE.LinearFilter;
  target.texture.magFilter = THREE.LinearFilter;
  target.texture.generateMipmaps = false;
  return target;
}

function ControlRasterPass({ viewport }: { viewport: ControlRasterViewport }) {
  const { path, node, transparentBg, internalResources, externalResources } = viewport;

  // Mirrors `<SubViewport>`'s own forced-rect handling: a STRETCHING
  // `SubViewportContainer` resizes its sub-viewport to its own rect divided
  // by `stretch_shrink`, whatever content kind that sub-viewport holds.
  const forcedRect = useViewportRect(path);
  const width = Math.max(1, Math.round(forcedRect?.x ?? viewport.size.x));
  const height = Math.max(1, Math.round(forcedRect?.y ?? viewport.size.y));

  const gl = useThree((state) => state.gl);
  const registerViewportTexture = useRegisterViewportTexture();
  const registerViewportPass = useRegisterViewportPass();
  const { themeScale } = useProjectSettings();

  const portalScene = useMemo(() => {
    const scene = new THREE.Scene();
    scene.name = `${node.name}::control-raster`;
    return scene;
  }, [node.name]);

  const target = useMemo(() => createRasterTarget(width, height, node.name), [width, height, node.name]);
  useEffect(() => () => target.dispose(), [target]);

  const entry = useMemo<ViewportTextureEntry>(
    () => ({ texture: target.texture, size: { x: width, y: height } }),
    [target, width, height]
  );
  useEffect(() => registerViewportTexture(path, entry), [registerViewportTexture, path, entry]);

  const dependsOn = useMemo(() => collectNestedViewportPaths(node, path), [node, path]);

  const camera = useMemo(() => new THREE.OrthographicCamera(), []);
  useEffect(() => {
    camera.near = 0.1;
    camera.far = 4000;
    applyOrthoFrame(camera, orthoFrameForSize({ x: width, y: height }));
  }, [camera, width, height]);

  const theme = useMemo(() => nativeTheme(themeScale), [themeScale]);
  const { tree, generation } = useBuildSolveTree(node.children, externalResources, internalResources);
  const solveViewport: Rect2 = useMemo(() => ({ x: 0, y: 0, w: width, h: height }), [width, height]);

  const renderPass = useCallback(() => {
    const previousTarget = gl.getRenderTarget();
    const previousAlpha = gl.getClearAlpha();
    const previousToneMapping = gl.toneMapping;
    const previousColor = new THREE.Color();
    gl.getClearColor(previousColor);

    try {
      // Controls are never tonemapped, on-screen or off (see module doc).
      gl.toneMapping = THREE.NoToneMapping;
      gl.setRenderTarget(target);
      gl.setClearColor(DEFAULT_CLEAR_COLOR, transparentBg ? 0 : 1);
      gl.clear(true, true, true);
      gl.render(portalScene, camera);
    } finally {
      gl.setRenderTarget(previousTarget);
      gl.setClearColor(previousColor, previousAlpha);
      gl.toneMapping = previousToneMapping;
    }
  }, [gl, target, transparentBg, portalScene, camera]);

  useEffect(
    () => registerViewportPass(path, { dependsOn, render: renderPass }),
    [registerViewportPass, path, dependsOn, renderPass]
  );

  return createPortal(
    <SceneResourcesProvider internalResources={internalResources} externalResources={externalResources}>
      <ControlCanvasWalker
        tree={tree}
        generation={generation}
        viewport={solveViewport}
        theme={theme}
        measurer={measureText}
      />
    </SceneResourcesProvider>,
    portalScene
  );
}
