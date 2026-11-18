/**
 * Owns a sub-viewport's render target, drives its offscreen pass and publishes the result.
 */

import { lazy, useCallback, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { createPortal, useThree } from '@react-three/fiber';
import { CanvasWorldContext, useCanvasWorld, useDrawCanvasWorld } from '../environment/canvasWorldScene';
import {
  CanvasWorldScope,
  SharedWorldEnvironmentScope,
  ViewportPassEnvironment,
  WorldEnvironmentScope,
} from '../environment/WorldEnvironmentScope';
import { drawWith } from '../environment/sceneEnvironment';
import type { CanvasColorSpace } from '../canvasColorSpace';
import { CanvasSpaceProvider } from '../canvasRootScope';
import { WorldRootProvider } from '../parentSpaceScope';
import * as THREE from 'three';

import type { NodeComponentProps } from '../NodeComponentRegistry';
import { ViewportDescriptionProvider } from './viewportDescriptionContext';
import { CanvasOverWorldScopeProvider } from './canvasOverWorldScope';
import { CanvasWorkspaceProvider } from '../contexts/CanvasWorkspaceContext';
import { useSceneShadowFit } from '../SceneShadowFitter';
import { useSceneDepthPrepass } from '../depthPrepass/SceneDepthPrepass';
import type { ViewportShadowAtlas } from '../positionalShadow/viewportShadowAtlas';
import { useViewportShadowAtlas } from '../positionalShadow/useViewportShadowAtlas';
import { World2DLightingBoundary } from '../lighting2d/World2DLightingBoundary';
import { CanvasLightPass } from '../lighting2d/CanvasLightPass';
import { createViewportLightPassHost } from './viewportLightPassHost';
import type { LightPassHost } from '../lighting2d/lightPassHost';
import { viewportTransfer } from '../texelCopy';
import type { Rgba } from '../../godot/math/math';
import {
  applyOrthoFrame,
  godotCanvasPlacement,
  frameOverView,
  orthoFrameForCamera2D,
  orthoFrameForSize,
  cameraAtPath,
  camera2DAtPath,
  viewportAspect,
} from './viewportFraming';
import { createCanvasTarget, createSceneTarget } from '../offscreen/targets';
import { renderToOffscreenTarget } from '../offscreen/draw';
import {
  CanvasFrameStepsContext,
  createCanvasFrameSteps,
  runCanvasFrame,
  type CanvasFrameSteps,
} from '../components/Canvas2DStage/canvasFrameSequence';
import { viewportCanvasColorSpace } from './viewportTargetOptions';
import { OffscreenToneMapStage, type OffscreenToneMap } from '../environment/offscreenToneMap';
import { ViewportPassAttributes } from '../environment/worldExposure';
import { useCurrentCamera2D } from '../currentCamera';
import type { Camera2DTag } from './camera2DView';
import { fitToAspect, fittedAspect } from './projectionFit';
import { PendingSuspense } from '../../resources/PendingSuspense';
import { usePublishViewportPass } from './usePublishViewportPass';
import { useGatedViewport } from './useGatedViewport';
import { useCanvasPass } from './useCanvasPass';
import type { SubViewportProperties } from '../../nodes/viewport/subviewport/types';
import type { Vector2 } from '../../godot/math/vector';
import { useProjectClearColor } from '../useProjectClearColor.js';
import type { ViewportDescription } from './viewportDescription';
import { drawWorld, type WorldRender } from './worldRender';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import { hideEditorHelpers } from '../editorHelpers';
import { viewAnchorMatrix } from '../viewportLayerAnchor';
import { drawCanvasKeys } from '../canvasKeyWindow';
import { BackgroundMode } from '../../godot/scene/environment';
import { canvasBackdropBound, drawOverBackground, isBehindWorld, isOverWorld } from './canvasBackdrop';
import { useBackdropTarget } from './useBackdropTarget';
import { canvasLayerRanks } from '../canvasPaintOrder';

const CanvasOverWorld = lazy(() =>
  import('./CanvasOverWorld.js').then((m) => ({ default: m.CanvasOverWorld }))
);

export interface OffscreenViewportPassProps extends NodeComponentProps {
  path: string;
  size: Vector2;
  /** The pixels Godot renders, before the cap: the 3D camera's aspect. */
  renderSize: Vector2;
  /** The viewport's visible rect, which a Camera2D centres in. `size` is the capped target. */
  layoutSize: Vector2;
  /** The canvas units the target shows, which frame the canvas: `layoutSize` unless a window scales its content. */
  viewSize: Vector2;
  kind: '2d' | '3d';
  rendersInline: boolean;
  /** The tint of this viewport's own canvas, where its light accumulation starts. */
  canvasModulate: Rgba;
  /** The 2D items and Controls a 3D pass draws over its world in one tree-order draw, else null. */
  canvasOverWorld: ReactNode | null;
  /** Whether the subtree holds a 2D item, which the viewport's World2D lights. */
  holdsCanvasItems: boolean;
  /** A SubViewport's from its properties, the root's from the project. */
  viewport: ViewportDescription;
}

/**
 * Owns the render target, drives the offscreen pass and publishes the result.
 * A separate component, so a Control-only sub-viewport mounts none of its hooks
 * and leaves the key to `ControlRasterPass.tsx`.
 */
export function OffscreenViewportPass({
  node,
  path,
  size,
  renderSize,
  layoutSize,
  viewSize,
  kind,
  rendersInline,
  canvasModulate,
  canvasOverWorld,
  holdsCanvasItems,
  viewport,
  children,
}: OffscreenViewportPassProps) {
  const properties = node.properties as SubViewportProperties;
  const { own_world_3d: ownWorld3D } = properties;
  const transparentBg = viewport.transparentBackground;
  const { x: width, y: height } = size;

  const gl = useThree((state) => state.gl);
  const clearColor = useProjectClearColor();
  const mainScene = useThree((state) => state.scene);
  const canvasCamera = useThree((state) => state.camera);
  // A portalled 3D pass in a shared world draws the canvas's world, which owns its scene's lights.
  const portals3D = kind === '3d' && !rendersInline;
  const canvasWorld = useCanvasWorld();
  const drawnCanvasWorld = portals3D && !ownWorld3D ? canvasWorld : null;
  useDrawCanvasWorld(drawnCanvasWorld);
  // The scene the pass draws: the parent's for an inline pass, else the one the portal fills.
  const passScene = useMemo(
    () => (rendersInline ? mainScene : (drawnCanvasWorld?.scene ?? createPassScene(node.name, 'offscreen'))),
    [rendersInline, mainScene, drawnCanvasWorld, node.name]
  );

  const canvasSpace = viewportCanvasColorSpace(properties);
  // One sample: a 3D pass multisamples its world buffer, and a 2D pass its canvas frame.
  const target = useMemo(
    () =>
      kind === '3d'
        ? createSceneTarget(width, height, node.name, canvasSpace)
        : createCanvasTarget(width, height, node.name, canvasSpace),
    [kind, width, height, node.name, canvasSpace]
  );
  useDisposeOnRelease(target);
  const { gate, clearMode, renderState } = useGatedViewport(path, properties);
  const drawsCanvasOverWorld = canvasOverWorld !== null;
  const msaaMode = kind === '3d' ? viewport.msaa3D : viewport.msaa2D;
  // Written only by the stage below while it is mounted.
  const toneMapStage = useRef<OffscreenToneMap | null>(null);
  // Godot tonemaps through the Environment of the world `find_world_3d()` resolves, so the stage
  // mounts in that world: beside an inline pass, and inside a portal, whose scope answers for both.
  // It reads the attributes and the Environment of this pass's own camera, which the world draws with.
  const stage =
    kind === '3d' ? (
      <ViewportPassAttributes path={path}>
        <ViewportPassEnvironment>
          <OffscreenToneMapStage
            stage={toneMapStage}
            target={target}
            msaaMode={msaaMode}
            width={width}
            height={height}
            transparentBackground={transparentBg}
            usesDebanding={viewport.usesDebanding}
            name={node.name}
          />
        </ViewportPassEnvironment>
      </ViewportPassAttributes>
    ) : null;
  // A 3D portal of its own world renders its lights only through this pass, so it fits them itself
  // and draws its own depth prepass. An inline pass renders the parent scene, which its own canvas
  // serves, the canvas's world serves its own scene, and a 2D portal holds no 3D surface.
  const portalLightScene = portals3D && !drawnCanvasWorld ? passScene : null;
  useSceneShadowFit(portalLightScene, viewport.positionalShadowAtlas);
  useSceneDepthPrepass(portalLightScene);
  const shadowAtlas = useViewportShadowAtlas(viewport.positionalShadowAtlas);
  const { worldRender, canvasRender } = useWorldRenders(viewport, shadowAtlas);

  // Both canvas draws take the viewport's `msaa_2d`: the 2D world's and the Controls'.
  const canvasMsaaMode = viewport.msaa2D;
  const { camera: orthoCamera, frame } = useCanvasPass(
    viewSize.x,
    viewSize.y,
    kind === '2d' || drawsCanvasOverWorld ? canvasMsaaMode : 0,
    canvasSpace
  );
  const backdropTarget = useBackdropTarget(width, height, node.name, canvasSpace);
  const canvasLayers = useMemo(() => canvasLayerRanks(node.children), [node]);
  // The scene the canvas of a 3D pass draws into, apart from the world's.
  const canvasScene = useMemo(
    () => (drawsCanvasOverWorld ? createPassScene(node.name, 'canvas') : null),
    [drawsCanvasOverWorld, node.name]
  );
  // This viewport's own World2D is lit by its own pass, run below once the camera is framed.
  // A resize reaches the host through `resize`, which keeps the host and the context it feeds.
  const firstSize = useRef(size).current;
  const litCanvasScene = kind === '2d' ? passScene : holdsCanvasItems ? canvasScene : null;
  const lightHost = useMemo(
    () => (litCanvasScene ? createViewportLightPassHost(litCanvasScene, orthoCamera, path, firstSize) : null),
    [litCanvasScene, orthoCamera, path, firstSize]
  );
  useLayoutEffect(() => lightHost?.resize(size), [lightHost, size]);
  // The steps of this viewport's canvas, which its shadow samplers join. With no lit canvas they
  // hold no light pass.
  const frameSteps = useMemo(() => canvasFrameStepsOf(lightHost), [lightHost]);

  // The canvas items of a viewport draw after its 3D render, into the same target. In sRGB, the frame's
  // bytes return to the SRGB8_ALPHA8 storage decoded, which the hardware encodes back to the same
  // bytes. A linear frame returns to the half-float storage as it is.
  const canvasFrameTransfer = canvasSpace.isLinear ? 'none' : 'decode';
  // `inWindow` null draws every layer, which no BG_CANVAS split asks for.
  const renderCanvas = useCallback(
    (into: THREE.WebGLRenderTarget, inWindow: ((key: number) => boolean) | null) =>
      renderToOffscreenTarget(gl, {
        target: into,
        clearColor,
        transparentBg,
        draw: () => {
          const drawCanvas = () =>
            frame.render(gl, canvasScene!, orthoCamera, viewportTransfer(canvasFrameTransfer, transparentBg));
          if (inWindow) drawCanvasKeys(canvasScene!, inWindow, drawCanvas);
          else drawCanvas();
        },
      }),
    [gl, clearColor, transparentBg, frame, canvasScene, orthoCamera, canvasFrameTransfer]
  );

  // Godot draws a viewport's canvas through its canvas transform, the identity until a Camera2D in
  // the subtree makes itself current, so the pass narrows this camera to that view each frame.
  const camera2DPath = useCurrentCamera2D(path);
  const backdropAnchor = useRef<THREE.Group>(null);
  const anchorBackdrop = useCallback(() => {
    const anchor = backdropAnchor.current;
    if (!anchor) return;
    viewAnchorMatrix(orthoCamera, viewSize, anchor.matrix);
    anchor.matrixWorldNeedsUpdate = true;
  }, [orthoCamera, viewSize]);
  const frameCanvas = useCallback(
    (canvas: THREE.Scene) => {
      // The camera's world matrix is what carries an instanced sub-scene's
      // transform, and nothing has refreshed it yet this frame: `gl.render`
      // updates matrices, and this pass runs before the main one.
      canvas.updateMatrixWorld(true);
      const camera2d = camera2DAtPath(canvas, camera2DPath);
      const tag = camera2d?.userData.camera2d as Camera2DTag | undefined;
      const framed =
        camera2d && tag
          ? orthoFrameForCamera2D(tag, godotCanvasPlacement(camera2d), layoutSize)
          : orthoFrameForSize(layoutSize);
      applyOrthoFrame(orthoCamera, frameOverView(framed, layoutSize, viewSize));
      anchorBackdrop();
    },
    [orthoCamera, layoutSize, viewSize, anchorBackdrop, camera2DPath]
  );

  const drawPass = useCallback(() => {
    const toneMap = kind === '3d' ? toneMapStage.current : null;
    const clear = renderState.takeRender(clearMode, clearColor);
    const camera = toneMap ? cameraAtPath(passScene, toneMap.cameraPath) : orthoCamera;
    const exposure = toneMap?.exposure ?? null;
    // Under BG_CANVAS the layers below `behindTo` draw first, and the world shows them as its background.
    const behindTo = canvasScene ? canvasBackdropBound(toneMap?.environment?.background, canvasLayers) : null;
    const backdrop = backdropTarget(behindTo !== null);
    if (backdrop) renderCanvas(backdrop, isBehindWorld(behindTo!));
    const keepsColor = toneMap?.environment?.background.mode === BackgroundMode.BG_KEEP;

    // Godot's rendered size, not the 2D override (`renderer_viewport.cpp:318`). The canvas gets its own back.
    const aspect = viewportAspect(renderSize);
    const restoreAspect = camera === canvasCamera ? fittedAspect(camera) : null;
    if (camera && fittedAspect(camera) !== aspect) fitToAspect(camera, aspect);

    try {
      renderToOffscreenTarget(gl, {
        target: toneMap ? toneMap.worldBuffer : target,
        clearColor: clear.color,
        transparentBg,
        keepsColor,
        // No camera is not an error: Godot renders the clear colour and nothing else.
        draw: () => {
          // A 3D pass clears its target itself where no render will, as `CanvasFrame.render`
          // explains. A 2D pass copies over it.
          const rendersClear = camera !== null && gl.autoClear;
          if (kind === '3d' && !rendersClear) gl.clear(!keepsColor, true, true);
          if (!camera) return;
          const showChrome = viewport.drawsEditorChrome ? null : hideEditorHelpers(passScene);
          try {
            if (kind === '2d') {
              frame.draw(gl, passScene, camera, clear.clears, viewportTransfer('none', transparentBg));
              return;
            }
            drawWorld(worldRender, () =>
              drawWith(passScene, toneMap!.environment, exposure, () =>
                backdrop
                  ? drawOverBackground(passScene, backdrop.texture, () => gl.render(passScene, camera))
                  : gl.render(passScene, camera)
              )
            );
          } finally {
            showChrome?.();
          }
        },
      });
      toneMap?.toneMap();
      if (canvasScene) renderCanvas(target, behindTo === null ? null : isOverWorld(behindTo));
    } finally {
      if (camera && restoreAspect !== null && restoreAspect !== aspect) fitToAspect(camera, restoreAspect);
    }
  }, [
    canvasCamera,
    passScene,
    kind,
    orthoCamera,
    gl,
    target,
    frame,
    viewport,
    worldRender,
    clearColor,
    transparentBg,
    renderSize,
    canvasScene,
    renderCanvas,
    backdropTarget,
    canvasLayers,
    renderState,
    clearMode,
  ]);

  // The camera is framed before the canvas runs its steps: the light pass reads it.
  const renderPass = useCallback(() => {
    // A 3D pass waits for its stage, which mounts before the frame that first publishes the target.
    if (kind === '3d' && !toneMapStage.current) return;
    if (kind === '2d') frameCanvas(passScene);
    if (canvasScene) frameCanvas(canvasScene);
    drawWorld(canvasRender, () => runCanvasFrame(frameSteps, drawPass));
  }, [kind, frameCanvas, passScene, canvasScene, frameSteps, drawPass, canvasRender]);

  // Consumers sample the texture directly. The ordered driver runs every
  // non-cyclic pass before R3F's own render, so a sampler sees this frame's
  // content, even on the frame the target is first published.
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

  const canvasBackdropAndItems = canvasOverWorld ? (
    <>
      <PendingSuspense>
        <CanvasOverWorld world={target.texture} size={viewSize} anchor={backdropAnchor} />
      </PendingSuspense>
      <CanvasOverWorldScopeProvider>{canvasOverWorld}</CanvasOverWorldScopeProvider>
    </>
  ) : null;
  const canvasPortal =
    canvasScene &&
    createPortal(
      <CanvasWorkspaceProvider workspace="2d">
        <WorldRootProvider value={canvasScene}>
          <CanvasSpaceProvider value={null}>
            <LitCanvas
              host={lightHost}
              steps={frameSteps}
              canvasModulate={canvasModulate}
              space={canvasSpace}
            >
              {canvasBackdropAndItems}
            </LitCanvas>
          </CanvasSpaceProvider>
        </WorldRootProvider>
      </CanvasWorkspaceProvider>,
      canvasScene
    );
  if (rendersInline) {
    return (
      <>
        {stage}
        {canvasPortal}
      </>
    );
  }
  const WorldScope = !ownWorld3D
    ? SharedWorldEnvironmentScope
    : kind === '2d'
      ? OwnCanvasWorldScope
      : OwnWorldEnvironmentScope;
  // The portal declares the workspace its content needs, not the host's, which
  // could drop it. The portal scene is detached, so no host CanvasItem transform
  // reaches it and a canvas root inside cancels nothing (`canvasRootScope.tsx`).
  // It is the world a node inside escapes to, too (`parentSpaceScope.tsx`). A WorldEnvironment
  // inside applies to an own world, and to the parent's world through a shared one.
  const portal = createPortal(
    <CanvasWorkspaceProvider workspace={kind === '3d' ? '3d' : '2d'}>
      <ViewportDescriptionProvider description={viewport}>
        <WorldRootProvider value={passScene}>
          <WorldScope>
            {stage}
            <CanvasSpaceProvider value={null}>
              <LitCanvas
                host={kind === '2d' ? lightHost : null}
                steps={frameSteps}
                canvasModulate={canvasModulate}
                space={canvasSpace}
              >
                {children}
              </LitCanvas>
            </CanvasSpaceProvider>
          </WorldScope>
        </WorldRootProvider>
      </ViewportDescriptionProvider>
    </CanvasWorkspaceProvider>,
    passScene
  );
  return (
    <>
      {canvasPortal}
      {portal}
    </>
  );
}

/**
 * A canvas lit by its viewport's 2D light pass, or one that no light reaches where `host` is null.
 * Either scope provides the canvas `space` with its modulate, so the lights seed in the space the
 * items shade in.
 */
function LitCanvas({
  host,
  steps,
  canvasModulate,
  space,
  children,
}: {
  host: LightPassHost | null;
  steps: CanvasFrameSteps;
  canvasModulate: Rgba;
  space: CanvasColorSpace;
  children: ReactNode;
}) {
  return host ? (
    <CanvasFrameStepsContext.Provider value={steps}>
      <CanvasLightPass host={host} canvasModulate={canvasModulate} space={space}>
        {children}
      </CanvasLightPass>
    </CanvasFrameStepsContext.Provider>
  ) : (
    <World2DLightingBoundary canvasModulate={canvasModulate} space={space}>
      {children}
    </World2DLightingBoundary>
  );
}

/** The pass's 3D world draw, and the canvas draw around the whole pass. */
function useWorldRenders(
  viewport: ViewportDescription,
  shadowAtlas: ViewportShadowAtlas
): { worldRender: WorldRender; canvasRender: WorldRender } {
  return useMemo(
    () => ({
      worldRender: { viewport, shadowAtlas, hasCanvasTransform: false },
      canvasRender: { viewport, shadowAtlas, hasCanvasTransform: true },
    }),
    [viewport, shadowAtlas]
  );
}

/** A detached scene a pass fills through a portal: the world's (`offscreen`) or the canvas's (`canvas`). */
function createPassScene(name: string, role: 'offscreen' | 'canvas'): THREE.Scene {
  const scene = new THREE.Scene();
  scene.name = `${name}::${role}`;
  return scene;
}

/**
 * The world of a viewport with `own_world_3d`. It hides the enclosing canvas's world, so a shared
 * viewport nested below reaches this world, as `find_world_3d()` does (`viewport.cpp:4670-4681`).
 */
function OwnWorldEnvironmentScope({ children }: { children: ReactNode }) {
  return (
    <WorldEnvironmentScope world="subViewport">
      <CanvasWorldContext.Provider value={null}>{children}</CanvasWorldContext.Provider>
    </WorldEnvironmentScope>
  );
}

/** An own world drawn as a 2D canvas, whose shared viewports draw its World3D, not the parent's. */
export function OwnCanvasWorldScope({ children }: { children: ReactNode }) {
  return (
    <OwnWorldEnvironmentScope>
      <CanvasWorldScope>{children}</CanvasWorldScope>
    </OwnWorldEnvironmentScope>
  );
}

/** The steps of a viewport's canvas, whose light step runs `host`, or no light step with no host. */
function canvasFrameStepsOf(host: LightPassHost | null): CanvasFrameSteps {
  const steps = createCanvasFrameSteps();
  if (host) steps.lightPass = () => host.run.current?.();
  return steps;
}
