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
  ViewportPassEnvironment,
  WorldEnvironmentScope,
} from '../../../r3f/environment/WorldEnvironmentScope';
import { drawWith } from '../../../r3f/environment/sceneEnvironment';
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
import type { Rgba } from '../../../godot/math/math';
import { SubViewportSamplerScope } from './SubViewportSamplerScope';
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

const ControlsOverWorld = lazy(() =>
  import('./ControlsOverWorld.js').then((m) => ({ default: m.ControlsOverWorld }))
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
  /** Whether a 3D pass draws the viewport's Controls over its world. */
  drawsControlsOverWorld: boolean;
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
  drawsControlsOverWorld,
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
  const msaaMode = viewportMsaaMode(properties, kind);
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
            usesDebanding={properties.use_debanding}
            name={node.name}
          />
        </ViewportPassEnvironment>
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

  // Godot draws a viewport's canvas through its canvas transform, the identity until a Camera2D in
  // the subtree makes itself current, so the pass narrows this camera to that view each frame.
  // Both canvas draws take the viewport's `msaa_2d`: the 2D world's and the Controls'.
  const canvasMsaaMode = viewportMsaaMode(properties, '2d');
  const { camera: orthoCamera, frame } = useCanvasPass(
    layoutSize.x,
    layoutSize.y,
    kind === '2d' || drawsControlsOverWorld ? canvasMsaaMode : 0
  );
  // The scene the Controls of a 3D pass draw into, apart from the world's.
  const controlsScene = useMemo(
    () => (drawsControlsOverWorld ? createPassScene(node.name, 'controls') : null),
    [drawsControlsOverWorld, node.name]
  );
  // This viewport's own World2D is lit by its own pass, run below once the camera is framed.
  // A resize reaches the host through `resize`, which keeps the host and the context it feeds.
  const firstSize = useRef(size).current;
  const lightHost = useMemo(
    () => (kind === '2d' ? createViewportLightPassHost(passScene, orthoCamera, path, firstSize) : null),
    [kind, passScene, orthoCamera, path, firstSize]
  );
  useLayoutEffect(() => lightHost?.resize(size), [lightHost, size]);

  // The canvas items of a viewport draw after its 3D render, into the same target. The frame's bytes
  // return to the SRGB8_ALPHA8 storage decoded, which the hardware encodes back to the same bytes.
  const renderControlsOverWorld = useCallback(
    () =>
      renderToOffscreenTarget(gl, {
        target,
        clearColor,
        transparentBg,
        toneMapping: THREE.NoToneMapping,
        draw: () => frame.render(gl, controlsScene!, orthoCamera, 'decode'),
      }),
    [gl, target, clearColor, transparentBg, frame, controlsScene, orthoCamera]
  );

  const renderPass = useCallback(() => {
    if (kind === '2d') {
      // The camera's world matrix is what carries an instanced sub-scene's
      // transform, and nothing has refreshed it yet this frame: `gl.render`
      // updates matrices, and this pass runs before the main one.
      passScene.updateMatrixWorld(true);
      const camera2d = selectViewportCamera2D(passScene);
      const tag = camera2d?.userData.camera2d as Camera2DTag | undefined;
      applyOrthoFrame(
        orthoCamera,
        camera2d && tag
          ? orthoFrameForCamera2D(tag, godotCanvasPosition(camera2d), layoutSize)
          : orthoFrameForSize(layoutSize)
      );
      lightHost?.run.current?.();
    }

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
      // Neither pass draws a curve: canvas items draw after Godot's 3D tonemap pass, and the 3D world
      // draws in linear HDR for its tonemap pass.
      renderToOffscreenTarget(gl, {
        target: toneMap ? toneMap.worldBuffer : target,
        clearColor,
        transparentBg,
        toneMapping: THREE.NoToneMapping,
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
                  : drawWith(passScene, toneMap!.environment, exposure, () => gl.render(passScene, camera))
              )
            );
          } finally {
            showChrome();
          }
        },
      });
      toneMap?.toneMap();
      if (controlsScene) renderControlsOverWorld();
    } finally {
      if (camera && restoreAspect !== null && restoreAspect !== aspect) fitToAspect(camera, restoreAspect);
    }
  }, [
    canvasCamera,
    passScene,
    kind,
    orthoCamera,
    lightHost,
    gl,
    target,
    frame,
    shadowAtlas,
    mipmapBias,
    clearColor,
    transparentBg,
    layoutSize,
    controlsScene,
    renderControlsOverWorld,
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

  const controlsPortal = controlsScene
    ? createPortal(
        <CanvasWorkspaceProvider workspace="2d">
          <WorldRootProvider value={controlsScene}>
            <CanvasSpaceProvider value={null}>
              <World2DLightingBoundary canvasModulate={canvasModulate}>
                <SubViewportSamplerScope properties={properties}>
                  <PendingSuspense>
                    <ControlsOverWorld
                      path={path}
                      nodes={node.children}
                      size={layoutSize}
                      world={target.texture}
                    />
                  </PendingSuspense>
                </SubViewportSamplerScope>
              </World2DLightingBoundary>
            </CanvasSpaceProvider>
          </WorldRootProvider>
        </CanvasWorkspaceProvider>,
        controlsScene
      )
    : null;
  if (rendersInline) {
    return (
      <>
        {stage}
        {controlsPortal}
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
              {lightHost ? (
                <CanvasLightPass host={lightHost} canvasModulate={canvasModulate}>
                  {children}
                </CanvasLightPass>
              ) : (
                <World2DLightingBoundary canvasModulate={canvasModulate}>{children}</World2DLightingBoundary>
              )}
            </CanvasSpaceProvider>
          </WorldScope>
        </WorldRootProvider>
      </AnisotropicFilteringProvider>
    </CanvasWorkspaceProvider>,
    passScene
  );
  return (
    <>
      {portal}
      {controlsPortal}
    </>
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

/** A detached scene a pass fills through a portal: the world's (`offscreen`) or the Controls' (`controls`). */
function createPassScene(name: string, role: 'offscreen' | 'controls'): THREE.Scene {
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
