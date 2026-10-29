/**
 * Owns a sub-viewport's render target, drives its offscreen pass and publishes the result.
 */

import { lazy, useCallback, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { createPortal, useThree } from '@react-three/fiber';
import {
  CanvasWorldContext,
  useCanvasWorld,
  useDrawCanvasWorld,
} from '../../../r3f/environment/canvasWorldScene';
import {
  CanvasWorldScope,
  SharedWorldEnvironmentScope,
  WorldEnvironmentScope,
} from '../../../r3f/environment/WorldEnvironmentScope';
import { CanvasSpaceProvider } from '../../../r3f/canvasRootScope';
import { WorldRootProvider } from '../../../r3f/parentSpaceScope';
import * as THREE from 'three';

import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { AnisotropicFilteringProvider } from '../../../r3f/contexts/AnisotropicFilteringContext';
import { CanvasWorkspaceProvider } from '../../../r3f/contexts/CanvasWorkspaceContext';
import { useSceneShadowFit } from '../../../r3f/SceneShadowFitter';
import { useSceneDepthPrepass } from '../../../r3f/depthPrepass/SceneDepthPrepass';
import {
  renderWithShadowAtlas,
  ViewportShadowAtlas,
} from '../../../r3f/positionalShadow/viewportShadowAtlas';
import { viewportPositionalShadowAtlas } from '../../../godot/scene/viewport';
import { World2DLightingBoundary } from '../../../r3f/lighting2d/World2DLightingBoundary';
import { CanvasLightPass } from '../../../r3f/lighting2d/CanvasLightPass';
import { createViewportLightPassHost } from './viewportLightPassHost';
import type { LightPassHost } from '../../../r3f/lighting2d/lightPassHost';
import type { Rgba } from '../../../godot/math/math';
import {
  applyOrthoFrame,
  createCanvasTarget,
  createSceneTarget,
  godotCanvasPosition,
  renderToOffscreenTarget,
  orthoFrameForCamera2D,
  orthoFrameForSize,
  cameraAtPath,
  selectViewportCamera2D,
  viewportAspect,
  viewportMsaaMode,
} from './offscreenViewport';
import { OffscreenToneMapStage, type OffscreenToneMap } from '../../../r3f/environment/offscreenToneMap';
import { ViewportPassAttributes } from '../../../r3f/environment/worldExposure';
import { drawAtExposure } from '../../../r3f/exposure/sceneExposure';
import type { Camera2DTag } from '../../2d/camera2d/cameraView';
import { fitToAspect, fittedAspect } from '../../3d/camera3d/projectionFit';
import { PendingSuspense } from '../../../resources/PendingSuspense';
import { usePublishViewportPass } from './usePublishViewportPass';
import { useCanvasPass } from './useCanvasPass';
import type { SubViewportProperties } from './types';
import type { Vector2 } from '../../../godot/math/vector';
import { useProjectClearColor } from '../../../r3f/useProjectClearColor.js';
import { renderWithMipmapBias } from '../../../r3f/materials/godotMipmapBias.js';
import { useProjectTextureMipmapBias } from '../../../r3f/materials/useProjectTextureMipmapBias.js';
import { useDisposeOnRelease } from '../../../r3f/useDisposeOnRelease';
import { hideEditorHelpers } from '../../../r3f/editorHelpers';
import { viewAnchorMatrix } from '../../../r3f/viewportLayerAnchor';

const CanvasOverWorld = lazy(() =>
  import('./CanvasOverWorld.js').then((m) => ({ default: m.CanvasOverWorld }))
);

export interface OffscreenViewportPassProps extends NodeComponentProps {
  path: string;
  size: Vector2;
  /** The viewport's `size`, which lays Controls out and frames the camera. `size` is the capped target. */
  layoutSize: Vector2;
  kind: '2d' | '3d';
  rendersInline: boolean;
  /** The tint of this viewport's own canvas, where its light accumulation starts. */
  canvasModulate: Rgba;
  /** The 2D items and Controls a 3D pass draws over its world in one tree-order draw, else null. */
  canvasOverWorld: ReactNode | null;
  /** Whether the subtree holds a 2D item, which the viewport's World2D lights. */
  holdsCanvasItems: boolean;
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
  layoutSize,
  kind,
  rendersInline,
  canvasModulate,
  canvasOverWorld,
  holdsCanvasItems,
  children,
}: OffscreenViewportPassProps) {
  const properties = node.properties as SubViewportProperties;
  const { transparent_bg: transparentBg, own_world_3d: ownWorld3D } = properties;
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

  // One sample: a 3D pass multisamples its world buffer, and a 2D pass its canvas frame.
  const target = useMemo(
    () => (kind === '3d' ? createSceneTarget : createCanvasTarget)(width, height, node.name),
    [kind, width, height, node.name]
  );
  useDisposeOnRelease(target);
  const drawsCanvasOverWorld = canvasOverWorld !== null;
  const msaaMode = viewportMsaaMode(properties, kind);
  // Written only by the stage below while it is mounted.
  const toneMapStage = useRef<OffscreenToneMap | null>(null);
  // Godot tonemaps through the Environment of the world `find_world_3d()` resolves, so the stage
  // mounts in that world: beside an inline pass, and inside a portal, whose scope answers for both.
  // It reads the attributes of this pass's own camera, which scale the world it draws.
  const stage =
    kind === '3d' ? (
      <ViewportPassAttributes path={path}>
        <OffscreenToneMapStage
          stage={toneMapStage}
          target={target}
          msaaMode={msaaMode}
          width={width}
          height={height}
          transparentBackground={transparentBg}
          usesDebanding={properties.use_debanding}
          name={node.name}
        />
      </ViewportPassAttributes>
    ) : null;
  // A 3D portal of its own world renders its lights only through this pass, so it fits them itself
  // and draws its own depth prepass. An inline pass renders the parent scene, which its own canvas
  // serves, the canvas's world serves its own scene, and a 2D portal holds no 3D surface.
  const portalLightScene = portals3D && !drawnCanvasWorld ? passScene : null;
  useSceneShadowFit(portalLightScene);
  useSceneDepthPrepass(portalLightScene);
  const shadowAtlas = useViewportShadowAtlas(properties);
  const projectMipmapBias = useProjectTextureMipmapBias();
  const mipmapBias = properties.texture_mipmap_bias ?? projectMipmapBias;

  // Both canvas draws take the viewport's `msaa_2d`: the 2D world's and the Controls'.
  const canvasMsaaMode = viewportMsaaMode(properties, '2d');
  const { camera: orthoCamera, frame } = useCanvasPass(
    layoutSize.x,
    layoutSize.y,
    kind === '2d' || drawsCanvasOverWorld ? canvasMsaaMode : 0
  );
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

  // The canvas items of a viewport draw after its 3D render, into the same target. The frame's bytes
  // return to the SRGB8_ALPHA8 storage decoded, which the hardware encodes back to the same bytes.
  const renderCanvasOverWorld = useCallback(
    () =>
      renderToOffscreenTarget(gl, {
        target,
        clearColor,
        transparentBg,
        draw: () => frame.render(gl, canvasScene!, orthoCamera, 'decode'),
      }),
    [gl, target, clearColor, transparentBg, frame, canvasScene, orthoCamera]
  );

  // Godot draws a viewport's canvas through its canvas transform, the identity until a Camera2D in
  // the subtree makes itself current, so the pass narrows this camera to that view each frame.
  const backdropAnchor = useRef<THREE.Group>(null);
  const anchorBackdrop = useCallback(() => {
    const anchor = backdropAnchor.current;
    if (!anchor) return;
    viewAnchorMatrix(orthoCamera, layoutSize, anchor.matrix);
    anchor.matrixWorldNeedsUpdate = true;
  }, [orthoCamera, layoutSize]);
  const frameCanvas = useCallback(
    (canvas: THREE.Scene) => {
      // The camera's world matrix is what carries an instanced sub-scene's
      // transform, and nothing has refreshed it yet this frame: `gl.render`
      // updates matrices, and this pass runs before the main one.
      canvas.updateMatrixWorld(true);
      const camera2d = selectViewportCamera2D(canvas);
      const tag = camera2d?.userData.camera2d as Camera2DTag | undefined;
      applyOrthoFrame(
        orthoCamera,
        camera2d && tag
          ? orthoFrameForCamera2D(tag, godotCanvasPosition(camera2d), layoutSize)
          : orthoFrameForSize(layoutSize)
      );
      anchorBackdrop();
      lightHost?.run.current?.();
    },
    [orthoCamera, layoutSize, lightHost, anchorBackdrop]
  );

  const renderPass = useCallback(() => {
    if (kind === '2d') frameCanvas(passScene);

    // A 3D pass waits for its stage, which mounts before the frame that first publishes the target.
    const toneMap = kind === '3d' ? toneMapStage.current : null;
    if (kind === '3d' && !toneMap) return;
    const camera = toneMap ? cameraAtPath(passScene, toneMap.cameraPath) : orthoCamera;
    const exposure = toneMap?.exposure ?? null;

    // A `<Camera3D>` camera mounts at the canvas aspect, and inside the viewport it frames the
    // target rect. Only a camera the canvas also renders through gets its fit back after the pass.
    const aspect = viewportAspect(layoutSize);
    const restoreAspect = camera === canvasCamera ? fittedAspect(camera) : null;
    if (camera && fittedAspect(camera) !== aspect) fitToAspect(camera, aspect);

    try {
      renderToOffscreenTarget(gl, {
        target: toneMap ? toneMap.worldBuffer : target,
        clearColor,
        transparentBg,
        // No camera is not an error: Godot renders the clear colour and nothing else.
        draw: () => {
          // A 3D pass clears its target itself where no render will, as `CanvasFrame.render`
          // explains. A 2D pass copies over it.
          const rendersClear = camera !== null && gl.autoClear;
          if (kind === '3d' && !rendersClear) gl.clear(true, true, true);
          if (!camera) return;
          // The pass draws through the viewport's own camera, which no editor gizmo is built for.
          const showChrome = hideEditorHelpers(passScene);
          try {
            renderWithMipmapBias(mipmapBias, () =>
              renderWithShadowAtlas(shadowAtlas, () =>
                kind === '2d'
                  ? frame.render(gl, passScene, camera)
                  : drawAtExposure(passScene, exposure, () => gl.render(passScene, camera))
              )
            );
          } finally {
            showChrome();
          }
        },
      });
      toneMap?.toneMap();
      if (canvasScene) {
        frameCanvas(canvasScene);
        renderCanvasOverWorld();
      }
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
    shadowAtlas,
    mipmapBias,
    clearColor,
    transparentBg,
    layoutSize,
    canvasScene,
    frameCanvas,
    renderCanvasOverWorld,
  ]);

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
    render: renderPass,
  });

  const canvasBackdropAndItems = canvasOverWorld ? (
    <>
      <PendingSuspense>
        <CanvasOverWorld world={target.texture} size={layoutSize} anchor={backdropAnchor} />
      </PendingSuspense>
      {canvasOverWorld}
    </>
  ) : null;
  const canvasPortal =
    canvasScene &&
    createPortal(
      <CanvasWorkspaceProvider workspace="2d">
        <WorldRootProvider value={canvasScene}>
          <CanvasSpaceProvider value={null}>
            <LitCanvas host={lightHost} canvasModulate={canvasModulate}>
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
      <AnisotropicFilteringProvider level={properties.anisotropic_filtering_level}>
        <WorldRootProvider value={passScene}>
          <WorldScope>
            {stage}
            <CanvasSpaceProvider value={null}>
              <LitCanvas host={kind === '2d' ? lightHost : null} canvasModulate={canvasModulate}>
                {children}
              </LitCanvas>
            </CanvasSpaceProvider>
          </WorldScope>
        </WorldRootProvider>
      </AnisotropicFilteringProvider>
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

/** A canvas lit by its viewport's 2D light pass, or one that no light reaches where `host` is null. */
function LitCanvas({
  host,
  canvasModulate,
  children,
}: {
  host: LightPassHost | null;
  canvasModulate: Rgba;
  children: ReactNode;
}) {
  return host ? (
    <CanvasLightPass host={host} canvasModulate={canvasModulate}>
      {children}
    </CanvasLightPass>
  ) : (
    <World2DLightingBoundary canvasModulate={canvasModulate}>{children}</World2DLightingBoundary>
  );
}

/**
 * The viewport's own positional shadow atlas, as Godot keeps one per viewport. A main view and this
 * pass that give an omni light different slots each keep their own cube, so a steady scene never
 * reallocates one per render. One shared cube would reallocate on every render the two disagree on.
 */
function useViewportShadowAtlas(properties: SubViewportProperties): ViewportShadowAtlas {
  const {
    positional_shadow_atlas_size: size,
    positional_shadow_atlas_quad_0: quad0,
    positional_shadow_atlas_quad_1: quad1,
    positional_shadow_atlas_quad_2: quad2,
    positional_shadow_atlas_quad_3: quad3,
  } = properties;
  const atlas = useMemo(
    () => new ViewportShadowAtlas(viewportPositionalShadowAtlas(size, [quad0, quad1, quad2, quad3])),
    [size, quad0, quad1, quad2, quad3]
  );
  useDisposeOnRelease(atlas);
  return atlas;
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
function OwnCanvasWorldScope({ children }: { children: ReactNode }) {
  return (
    <OwnWorldEnvironmentScope>
      <CanvasWorldScope>{children}</CanvasWorldScope>
    </OwnWorldEnvironmentScope>
  );
}
