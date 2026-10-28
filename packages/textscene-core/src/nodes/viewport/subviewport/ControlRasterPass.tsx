/**
 * The native (WebGL) render-to-texture publisher for a Control-only sub-viewport
 * (`viewportContentKind === 'dom'`), which `<SubViewport>`'s own pass declines. It
 * mounts the Control walker into a detached scene, draws it through a fixed camera
 * framing the target rect, and publishes a texture consumers sample directly.
 */
import { useCallback, useMemo } from 'react';
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
import { SubViewportSamplerScope } from './SubViewportSamplerScope';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme.js';
import { measureText } from '../../../r3f/controls/native/text/measurer.js';
import type { Rect2 } from '../../../godot/math/rect2.js';
import { createCanvasTarget, renderToOffscreenTarget, viewportMsaaMode } from './offscreenViewport.js';
import { useMultisampledTarget } from '../../../r3f/multisampledTarget.js';
import { useCanvasPass } from './useCanvasPass.js';
import { usePublishViewportPass } from './usePublishViewportPass.js';
import type { ControlRasterViewport } from './controlRasterViewports.js';
import { viewportTargetSize } from './targetSize.js';
import type { SubViewportProperties } from './types.js';
import { useProjectClearColor } from '../../../r3f/useProjectClearColor.js';
import { useCanvasModulateColor } from '../../../r3f/canvasModulate.js';
import { World2DLightingBoundary } from '../../../r3f/lighting2d/World2DLightingBoundary.js';

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

function ControlRasterPass({ viewport }: { viewport: ControlRasterViewport }) {
  const { path, node, inheritedRtl, internalResources, externalResources } = viewport;

  const properties = node.properties as SubViewportProperties;
  const { size, transparent_bg: transparentBg } = properties;
  const { x: width, y: height } = viewportTargetSize(size, useViewportRect(path));

  const gl = useThree((state) => state.gl);
  const clearColor = useProjectClearColor();
  const { themeScale } = useProjectSettings();

  const portalScene = useMemo(() => {
    const scene = new THREE.Scene();
    scene.name = `${node.name}::control-raster`;
    return scene;
  }, [node.name]);

  // Godot draws canvas items after the tonemap pass (`RendererViewport::_draw_viewport`), so the
  // target holds sRGB values with no curve, and a 3D consumer applies its curve once: a 0.5 grey
  // ColorRect reaches it as rgb(162), not a pre-tonemapped rgb(196).
  const createTarget = useCallback(
    () => createCanvasTarget(width, height, node.name),
    [width, height, node.name]
  );
  // The frame takes the 2D buffer's multisampling, so the target it copies into never multisamples.
  const target = useMultisampledTarget(0, createTarget);
  const { camera, frame } = useCanvasPass(width, height, viewportMsaaMode(properties, '2d'));

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
  const canvasModulate = useCanvasModulateColor(node.children);
  const solveViewport: Rect2 = useMemo(() => ({ x: 0, y: 0, w: width, h: height }), [width, height]);

  const renderPass = useCallback(() => {
    renderToOffscreenTarget(gl, {
      target,
      clearColor,
      transparentBg,
      // Controls are never tonemapped, on-screen or off.
      toneMapping: THREE.NoToneMapping,
      draw: () => frame.render(gl, portalScene, camera),
    });
  }, [gl, target, frame, clearColor, transparentBg, portalScene, camera]);

  usePublishViewportPass({
    path,
    node,
    target,
    width,
    height,
    isTransparent: transparentBg,
    render: renderPass,
  });

  return createPortal(
    <SceneResourcesProvider internalResources={internalResources} externalResources={externalResources}>
      <World2DLightingBoundary canvasModulate={canvasModulate}>
        <SubViewportSamplerScope properties={properties}>
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
        </SubViewportSamplerScope>
      </World2DLightingBoundary>
    </SceneResourcesProvider>,
    portalScene
  );
}
