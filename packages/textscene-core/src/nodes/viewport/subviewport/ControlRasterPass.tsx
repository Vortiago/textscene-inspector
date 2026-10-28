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

  const canvasModulate = useCanvasModulateColor(node.children);
  const controlsSize = useMemo(() => ({ x: width, y: height }), [width, height]);

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
          <ViewportControls nodes={node.children} size={controlsSize} inheritedRtl={inheritedRtl} />
        </SubViewportSamplerScope>
      </World2DLightingBoundary>
    </SceneResourcesProvider>,
    portalScene
  );
}
