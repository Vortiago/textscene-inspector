/**
 * The native (WebGL) render-to-texture publisher for a Control-only sub-viewport
 * (`viewportContentKind === 'dom'`), which `<SubViewport>`'s own pass declines. It
 * mounts the Control walker into a detached scene, draws it through a fixed camera
 * framing the target rect, and publishes a texture consumers sample directly.
 */
import { useCallback, useMemo } from 'react';
import { createPortal, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { useViewportRect } from '../../../r3f/contexts/ViewportRectContext.js';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext.js';
import { SubViewportSamplerScope } from './SubViewportSamplerScope';
import { ViewportControls } from './ViewportControls.js';
import { viewportTransfer } from '../../../r3f/texelCopy.js';
import {
  createCanvasTarget,
  renderToOffscreenTarget,
  viewportCanvasColorSpace,
  viewportMsaaMode,
} from './offscreenViewport.js';
import { CanvasColorSpaceProvider } from '../../../r3f/canvasColorSpace.js';
import { useMultisampledTarget } from '../../../r3f/multisampledTarget.js';
import { useCanvasPass } from './useCanvasPass.js';
import { useResolvedGate } from './useViewportGate.js';
import { usePublishViewportPass } from './usePublishViewportPass.js';
import { useViewportRenderState } from './useGatedViewport.js';
import type { ControlRasterViewport } from './controlRasterViewports.js';
import { viewportSize, viewportTargetSize } from './targetSize.js';
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
  const gate = useResolvedGate(viewport.gate);

  const properties = node.properties as SubViewportProperties;
  const { size, transparent_bg: transparentBg, render_target_clear_mode: clearMode } = properties;
  const forcedRect = useViewportRect(path);
  const { x: width, y: height } = viewportTargetSize(size, forcedRect);
  const { x: layoutWidth, y: layoutHeight } = viewportSize(size, forcedRect);

  const gl = useThree((state) => state.gl);
  const clearColor = useProjectClearColor();

  const portalScene = useMemo(() => {
    const scene = new THREE.Scene();
    scene.name = `${node.name}::control-raster`;
    return scene;
  }, [node.name]);

  // Godot draws canvas items after the tonemap pass (`RendererViewport::_draw_viewport`), so the
  // target holds sRGB values with no curve, and a 3D consumer applies its curve once: a 0.5 grey
  // ColorRect reaches it as rgb(162), not a pre-tonemapped rgb(196).
  const canvasSpace = viewportCanvasColorSpace(properties, '2d');
  const createTarget = useCallback(
    () => createCanvasTarget(width, height, node.name, canvasSpace),
    [width, height, node.name, canvasSpace]
  );
  // The frame takes the 2D buffer's multisampling, so the target it copies into never multisamples.
  const target = useMultisampledTarget(0, createTarget);
  const { camera, frame } = useCanvasPass(
    layoutWidth,
    layoutHeight,
    viewportMsaaMode(properties, '2d'),
    canvasSpace
  );

  const canvasModulate = useCanvasModulateColor(node.children);
  const controlsSize = useMemo(() => ({ x: layoutWidth, y: layoutHeight }), [layoutWidth, layoutHeight]);

  const renderState = useViewportRenderState(gate.updateMode);
  const renderPass = useCallback(() => {
    const clear = renderState.takeRender(clearMode, clearColor);
    renderToOffscreenTarget(gl, {
      target,
      clearColor: clear.color,
      transparentBg,
      draw: () => frame.draw(gl, portalScene, camera, clear.clears, viewportTransfer('none', transparentBg)),
    });
  }, [gl, target, frame, clearColor, clearMode, renderState, transparentBg, portalScene, camera]);

  usePublishViewportPass({
    path,
    node,
    target,
    width,
    height,
    isTransparent: transparentBg,
    gate,
    renderState,
    render: renderPass,
  });

  return createPortal(
    <SceneResourcesProvider internalResources={internalResources} externalResources={externalResources}>
      <World2DLightingBoundary canvasModulate={canvasModulate}>
        <SubViewportSamplerScope properties={properties}>
          <CanvasColorSpaceProvider value={canvasSpace}>
            <ViewportControls nodes={node.children} size={controlsSize} inheritedRtl={inheritedRtl} />
          </CanvasColorSpaceProvider>
        </SubViewportSamplerScope>
      </World2DLightingBoundary>
    </SceneResourcesProvider>,
    portalScene
  );
}
