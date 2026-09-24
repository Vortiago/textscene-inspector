/**
 * The native (WebGL) render-to-texture publisher for a Control-only sub-viewport
 * (`viewportContentKind === 'dom'`), which `<SubViewport>`'s own pass declines. It
 * mounts the Control walker into a detached scene, renders it through a fixed camera
 * framing the target rect, and publishes a texture consumers sample directly.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { createPortal, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// The barrel, not `ControlCanvasWalker.tsx`: its side-effect imports register
// every `Native` painter, which a canvas with no on-screen Controls never loads
// otherwise, leaving each Control a `<ControlFallback>` outline. Callers
// lazy-load this module, so a scene without a Control-only viewport pays nothing.
import '../../../r3f/controls/index.js';
import { useViewportRect } from '../../../r3f/contexts/ViewportRectContext.js';
import { useProjectSettings } from '../../../r3f/contexts/ProjectSettingsContext.js';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext.js';
import { useBuildSolveTree } from '../../../r3f/controls/native/buildSolveTree.js';
import { ControlCanvasWalker } from '../../../r3f/controls/native/ControlCanvasWalker.js';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme.js';
import { measureText } from '../../../r3f/controls/native/text/measurer.js';
import type { Rect2 } from '../../../r3f/controls/native/rect.js';
import {
  applyOrthoFrame,
  createOffscreenTarget,
  orthoFrameForSize,
  renderToOffscreenTarget,
} from './offscreenViewport.js';
import { usePublishViewportPass } from './usePublishViewportPass.js';
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

/**
 * Godot draws canvas items after the tonemap pass (`RendererViewport::_draw_viewport`),
 * so the target holds sRGB values with no curve, and the consumer applies the curve
 * once: a 0.5 grey ColorRect reaches it as rgb(162), not a pre-tonemapped rgb(196).
 * Hence sRGB storage and no pre-tonemap flag, the opposite of the 3D/2D pass.
 */
function createRasterTarget(width: number, height: number, name: string): THREE.WebGLRenderTarget {
  return createOffscreenTarget(width, height, name, {
    colorSpace: THREE.SRGBColorSpace,
    preTonemapped: false,
  });
}

function ControlRasterPass({ viewport }: { viewport: ControlRasterViewport }) {
  const { path, node, transparentBg, inheritedRtl, internalResources, externalResources } = viewport;

  // Mirrors `<SubViewport>`'s own forced-rect handling: a stretching
  // `SubViewportContainer` resizes its sub-viewport to its own rect divided
  // by `stretch_shrink`, whatever content kind that sub-viewport holds.
  const forcedRect = useViewportRect(path);
  const width = Math.max(1, Math.round(forcedRect?.x ?? viewport.size.x));
  const height = Math.max(1, Math.round(forcedRect?.y ?? viewport.size.y));

  const gl = useThree((state) => state.gl);
  const { themeScale } = useProjectSettings();

  const portalScene = useMemo(() => {
    const scene = new THREE.Scene();
    scene.name = `${node.name}::control-raster`;
    return scene;
  }, [node.name]);

  const target = useMemo(() => createRasterTarget(width, height, node.name), [width, height, node.name]);
  useEffect(() => () => target.dispose(), [target]);

  const camera = useMemo(() => new THREE.OrthographicCamera(), []);
  useEffect(() => {
    camera.near = 0.1;
    camera.far = 4000;
    applyOrthoFrame(camera, orthoFrameForSize({ x: width, y: height }));
  }, [camera, width, height]);

  const theme = useMemo(() => nativeTheme(themeScale), [themeScale]);
  // The rtl climb steps straight over a `SubViewport` (`control.cpp:3584-3598`,
  // and `ControlRasterViewport.inheritedRtl`), so this forest starts from the
  // direction of the Control that encloses the viewport, not from scratch.
  const { tree, generation } = useBuildSolveTree(
    node.children,
    externalResources,
    internalResources,
    inheritedRtl
  );
  const solveViewport: Rect2 = useMemo(() => ({ x: 0, y: 0, w: width, h: height }), [width, height]);

  const renderPass = useCallback(() => {
    renderToOffscreenTarget(gl, {
      target,
      transparentBg,
      // Controls are never tonemapped, on-screen or off.
      toneMapping: THREE.NoToneMapping,
      draw: () => gl.render(portalScene, camera),
    });
  }, [gl, target, transparentBg, portalScene, camera]);

  usePublishViewportPass({ path, node, texture: target.texture, width, height, render: renderPass });

  return createPortal(
    <SceneResourcesProvider internalResources={internalResources} externalResources={externalResources}>
      <ControlCanvasWalker
        tree={tree}
        generation={generation}
        viewport={solveViewport}
        theme={theme}
        measurer={measureText}
        // `scene/main/viewport.h`: `bool snap_controls_to_pixels = true` on
        // every Viewport, and only the root window gets
        // `gui/common/snap_controls_to_pixels` (`main/main.cpp`), so a project
        // that opts out leaves a SubViewport's own Controls snapped.
        snapToPixels
      />
    </SceneResourcesProvider>,
    portalScene
  );
}
