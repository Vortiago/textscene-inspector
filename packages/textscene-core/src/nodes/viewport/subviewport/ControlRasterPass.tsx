/**
 * The native (WebGL) render-to-texture publisher for a sub-viewport with no world content
 * (`viewportContentAt(…).kind === 'dom'`), which `<SubViewport>`'s own pass declines. It
 * mounts the Control walker into a detached scene, draws it through a fixed camera
 * framing the target rect, and publishes a texture consumers sample directly. A viewport
 * with no Control publishes the clear alone.
 */
import { useCallback, useMemo } from 'react';
import { createPortal, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { useViewportSize } from '../../../r3f/contexts/ViewportSizeContext.js';
import type { Vector2 } from '../../../godot/math/vector.js';
import { useViewportRect } from '../../../r3f/contexts/ViewportRectContext.js';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext.js';
import { SubViewportCanvasScope } from './SubViewportCanvasScope';
import { ViewportControls } from './ViewportControls.js';
import { viewportTransfer } from '../../../r3f/texelCopy.js';
import {
  createCanvasTarget,
  renderToOffscreenTarget,
  viewportCanvasColorSpace,
  viewportMsaaMode,
} from './offscreenViewport.js';
import { useMultisampledTarget } from '../../../r3f/multisampledTarget.js';
import { useCanvasPass } from './useCanvasPass.js';
import { useResolvedGate } from './useViewportGate.js';
import { usePublishViewportPass } from './usePublishViewportPass.js';
import { useViewportRenderState } from './useGatedViewport.js';
import type { ControlRasterViewport } from './controlRasterViewports.js';
import { viewportPassSizes } from './targetSize.js';
import type { SubViewportProperties } from './types.js';
import { useProjectClearColor } from '../../../r3f/useProjectClearColor.js';
import { useCanvasModulateColor } from '../../../r3f/canvasModulate.js';
import { World2DLightingBoundary } from '../../../r3f/lighting2d/World2DLightingBoundary.js';
import { useStableVector2 } from '../../../r3f/hooks/useStableVector2';

export interface ControlRasterPassesProps {
  /** The sub-viewports with no world content found in the scene, each with its own resource scope (ADR-0009). */
  viewports: readonly ControlRasterViewport[];
}

/** One native offscreen pass per sub-viewport with no world content in the scene. */
export function ControlRasterPasses({ viewports }: ControlRasterPassesProps) {
  return (
    <>
      {viewports.map((viewport) => (
        <ControlRasterPass key={viewport.path} viewport={viewport} />
      ))}
    </>
  );
}

/** The visible size of the viewport around this one: its layout size, else the project's. */
function useEnclosingViewportSize(embedder: ControlRasterViewport['embedder']): Vector2 {
  const projectSize = useViewportSize();
  const forced = useViewportRect(embedder?.path ?? null);
  const layout = embedder ? viewportPassSizes(embedder.node, forced).layout : projectSize;
  return useStableVector2(layout);
}

function ControlRasterPass({ viewport }: { viewport: ControlRasterViewport }) {
  const { path, node, inheritedRtl, themeOwners, embedder, internalResources, externalResources } = viewport;
  const gate = useResolvedGate(viewport.gate);

  const properties = node.properties as SubViewportProperties;
  const { transparent_bg: transparentBg, render_target_clear_mode: clearMode } = properties;
  const sizes = viewportPassSizes(node, useViewportRect(path));
  const { x: width, y: height } = sizes.target;

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
  const canvasSpace = viewportCanvasColorSpace(properties);
  const createTarget = useCallback(
    () => createCanvasTarget(width, height, node.name, canvasSpace),
    [width, height, node.name, canvasSpace]
  );
  // The frame takes the 2D buffer's multisampling, so the target it copies into never multisamples.
  const target = useMultisampledTarget(0, createTarget);
  const { camera, frame } = useCanvasPass(
    sizes.view.x,
    sizes.view.y,
    viewportMsaaMode(properties, '2d'),
    canvasSpace
  );

  const canvasModulate = useCanvasModulateColor(node.children);
  const controlsSize = useStableVector2(sizes.layout);
  const enclosingViewportSize = useEnclosingViewportSize(embedder);

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
      <World2DLightingBoundary canvasModulate={canvasModulate} space={canvasSpace}>
        <SubViewportCanvasScope properties={properties}>
          <ViewportControls
            path={path}
            viewport={node}
            size={controlsSize}
            inheritedRtl={inheritedRtl}
            themeOwners={themeOwners}
            enclosingViewportSize={enclosingViewportSize}
            sortsLocally
          />
        </SubViewportCanvasScope>
      </World2DLightingBoundary>
    </SceneResourcesProvider>,
    portalScene
  );
}
