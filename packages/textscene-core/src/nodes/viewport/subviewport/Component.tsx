/**
 * SubViewport: a canvas boundary that is not a world boundary (ADR-0033), and the
 * publisher of its own offscreen render target. Godot resolves `World3D` up to the
 * parent viewport unless `own_world_3d` is set, while `World2D` is always its own,
 * so Node3D descendants draw in the parent's view and CanvasItem descendants do not.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal, useThree } from '@react-three/fiber';
import { WorldEnvironmentScope } from '../../../r3f/environment/WorldEnvironmentScope';
import { CanvasSpaceProvider } from '../../../r3f/canvasRootScope';
import { WorldRootProvider } from '../../../r3f/parentSpaceScope';
import * as THREE from 'three';

import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { AnisotropicFilteringProvider } from '../../../r3f/contexts/AnisotropicFilteringContext';
import { useProjectSettings } from '../../../r3f/contexts/ProjectSettingsContext';
import { projectAnisotropicFilteringLevel } from '../../../parser/projectSettingsParser';
import { CanvasWorkspaceProvider, useCanvasWorkspace } from '../../../r3f/contexts/CanvasWorkspaceContext';
import { useViewportRect } from '../../../r3f/contexts/ViewportRectContext';
import { useSceneShadowFit } from '../../../r3f/SceneShadowFitter';
import { useSceneDepthPrepass } from '../../../r3f/depthPrepass/SceneDepthPrepass';
import {
  renderWithShadowAtlas,
  ViewportShadowAtlas,
} from '../../../r3f/positionalShadow/viewportShadowAtlas';
import { viewportPositionalShadowAtlas } from '../../../godot/scene/viewport';
import { Node } from '../../node/Component';
import { World2DLightingBoundary } from '../../../r3f/lighting2d/World2DLightingBoundary';
import {
  applyOrthoFrame,
  createCanvasTarget,
  createSceneTarget,
  godotCanvasPosition,
  renderToOffscreenTarget,
  orthoFrameForCamera2D,
  orthoFrameForSize,
  selectViewportCamera,
  selectViewportCamera2D,
  viewportAspect,
  viewportMsaaMode,
} from './offscreenViewport';
import { useMultisampledTarget } from '../../../r3f/multisampledTarget';
import type { Camera2DTag } from '../../2d/camera2d/cameraView';
import { fitToAspect, fittedAspect } from '../../3d/camera3d/projectionFit';
import { useViewportContentKind } from './useViewportContentKind';
import { usePublishViewportPass } from './usePublishViewportPass';
import type { SubViewportProperties } from './types';
import { viewportTargetSize } from './targetSize';
import { createViewportCanvasCamera } from '../../../r3f/sceneRenderCamera.js';
import { useProjectClearColor } from '../../../r3f/useProjectClearColor.js';
import { renderWithMipmapBias } from '../../../r3f/materials/godotMipmapBias.js';
import { useProjectTextureMipmapBias } from '../../../r3f/materials/useProjectTextureMipmapBias.js';
import {
  recompileOnCurveChange,
  SHARED_WORLD_TONE_MAPPING,
} from '../../../resources/environment/toneMapping';
import { useDisposeOnRelease } from '../../../r3f/useDisposeOnRelease';

/**
 * Registered with neither `canvasItem` nor `container`, so `PlainNode` passes it
 * through in the 3D workspace and drops its subtree in the 2D one. `disable_3d` is
 * not read: it leaves the parent view untouched. The subtree mounts once, since a
 * second mount registers a second Object3D at the same path.
 */
export function SubViewport({ node, children }: NodeComponentProps) {
  const { own_world_3d: ownWorld3D } = node.properties as SubViewportProperties;
  const workspace = useCanvasWorkspace();
  const path = useNodePath() ?? node.name;
  // Classified over the resolved subtree: in the parsed graph an `instance=`
  // child is a typeless, childless node, so an untouched 2D sub-scene and an
  // untouched 3D one are indistinguishable until the sub-scene lands.
  const kind = useViewportContentKind(node);

  // Only content this subsystem can rasterise gets an offscreen pass; Controls
  // are the native Control-raster pass's (`ControlRasterPass.tsx`), and an
  // empty viewport has nothing to draw.
  const rasterizes = kind === '3d' || kind === '2d';

  // The subtree draws inline only for 3D content in a shared world in a 3D
  // canvas. Otherwise the offscreen pass portals it. Without a pass, the children
  // pass through on the `own_world_3d` rule, since a component renders what the
  // dispatcher hands it (subtreeConformance).
  const rendersInline = rasterizes ? kind === '3d' && !ownWorld3D && workspace === '3d' : !ownWorld3D;
  // On either path the subtree's canvas items are in this viewport's World2D, never the parent's.
  const contents = <World2DLightingBoundary>{children}</World2DLightingBoundary>;

  return (
    <Node node={node}>
      {rendersInline ? contents : null}
      {rasterizes ? (
        <OffscreenViewport node={node} path={path} kind={kind} rendersInline={rendersInline}>
          {rendersInline ? null : contents}
        </OffscreenViewport>
      ) : null}
    </Node>
  );
}

interface OffscreenViewportProps extends NodeComponentProps {
  path: string;
  kind: '2d' | '3d';
  rendersInline: boolean;
}

/**
 * Owns the render target, drives the offscreen pass and publishes the result.
 * A separate component, so a Control-only sub-viewport mounts none of its hooks
 * and leaves the key to `ControlRasterPass.tsx`.
 */
function OffscreenViewport({ node, path, kind, rendersInline, children }: OffscreenViewportProps) {
  const properties = node.properties as SubViewportProperties;
  const { size, transparent_bg: transparentBg } = properties;
  const { x: width, y: height } = viewportTargetSize(size, useViewportRect(path));

  const gl = useThree((state) => state.gl);
  const clearColor = useProjectClearColor();
  const mainScene = useThree((state) => state.scene);
  const canvasCamera = useThree((state) => state.camera);
  const portalScene = useMemo(() => {
    const scene = new THREE.Scene();
    scene.name = `${node.name}::offscreen`;
    return scene;
  }, [node.name]);

  const createTarget = useCallback(
    () => (kind === '3d' ? createSceneTarget : createCanvasTarget)(width, height, node.name),
    [kind, width, height, node.name]
  );
  const target = useMultisampledTarget(viewportMsaaMode(properties, kind), createTarget);
  // A 3D portal renders its lights only through this pass, so it fits them itself and draws its
  // own depth prepass. An inline pass renders the parent scene, which its own canvas serves, and a
  // 2D portal holds no 3D surface.
  const portalLightScene = kind === '3d' && !rendersInline ? portalScene : null;
  useSceneShadowFit(portalLightScene);
  useSceneDepthPrepass(portalLightScene);
  const shadowAtlas = useViewportShadowAtlas(properties);
  const projectMipmapBias = useProjectTextureMipmapBias();
  const mipmapBias = properties.texture_mipmap_bias ?? projectMipmapBias;
  const projectSettings = useProjectSettings().settings;
  const anisotropicFilteringLevel =
    properties.anisotropic_filtering_level ?? projectAnisotropicFilteringLevel(projectSettings);

  // A persistent camera for 2D-world content. Godot draws a viewport's canvas
  // through its canvas transform, the identity until a Camera2D in the subtree
  // makes itself current, so this starts at the whole target rect and the pass
  // narrows it to the current camera's view each frame.
  const orthoCamera = useMemo(() => createViewportCanvasCamera(), []);
  /** Written only by the pass, through `recompileOnCurveChange`. */
  const portalCurve = useRef({ revision: -1 });
  useEffect(() => {
    orthoCamera.near = 0.1;
    orthoCamera.far = 4000;
    applyOrthoFrame(orthoCamera, orthoFrameForSize({ x: width, y: height }));
  }, [orthoCamera, width, height]);

  const renderPass = useCallback(() => {
    const source = rendersInline ? mainScene : portalScene;

    if (kind === '2d') {
      // The camera's world matrix is what carries an instanced sub-scene's
      // transform, and nothing has refreshed it yet this frame: `gl.render`
      // updates matrices, and this pass runs before the main one.
      source.updateMatrixWorld(true);
      const camera2d = selectViewportCamera2D(source);
      const tag = camera2d?.userData.camera2d as Camera2DTag | undefined;
      applyOrthoFrame(
        orthoCamera,
        camera2d && tag
          ? orthoFrameForCamera2D(tag, godotCanvasPosition(camera2d), { x: width, y: height })
          : orthoFrameForSize({ x: width, y: height })
      );
    }

    const camera = kind === '3d' ? selectViewportCamera(source, path) : orthoCamera;
    // Godot tonemaps through the environment `find_world_3d()` resolves. A shared world's curve is
    // the root environment's, on either of its routes. This pass reads only the root's curve, so an
    // own world draws none. Canvas items draw after the 3D tonemap pass, so a 2D canvas gets none.
    const isSharedWorld = !properties.own_world_3d && kind === '3d';
    const toneMapping = isSharedWorld ? SHARED_WORLD_TONE_MAPPING : THREE.NoToneMapping;
    if (isSharedWorld && !rendersInline) recompileOnCurveChange(source, portalCurve.current);

    // A `<Camera3D>` camera mounts at the canvas aspect, and inside the viewport it frames the
    // target rect. Only a camera the canvas also renders through gets its fit back after the pass.
    const aspect = viewportAspect({ x: width, y: height });
    const restoreAspect = camera === canvasCamera ? fittedAspect(camera) : null;
    if (camera && fittedAspect(camera) !== aspect) fitToAspect(camera, aspect);

    try {
      renderToOffscreenTarget(gl, {
        target,
        clearColor,
        transparentBg,
        toneMapping,
        // No camera is not an error: Godot renders the clear colour and nothing else.
        draw: () => {
          if (camera) {
            renderWithMipmapBias(mipmapBias, () =>
              renderWithShadowAtlas(shadowAtlas, () => gl.render(source, camera))
            );
          }
        },
      });
    } finally {
      if (camera && restoreAspect !== null && restoreAspect !== aspect) fitToAspect(camera, restoreAspect);
    }
  }, [
    rendersInline,
    mainScene,
    canvasCamera,
    portalScene,
    kind,
    path,
    orthoCamera,
    gl,
    target,
    shadowAtlas,
    mipmapBias,
    clearColor,
    transparentBg,
    properties.own_world_3d,
    width,
    height,
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
    render: renderPass,
  });

  if (rendersInline) return null;
  // The portal declares the workspace its content needs, not the host's, which
  // could drop it. The portal scene is detached, so no host CanvasItem transform
  // reaches it and a canvas root inside cancels nothing (`canvasRootScope.tsx`).
  // It is the world a node inside escapes to, too (`parentSpaceScope.tsx`), and the world a
  // WorldEnvironment inside applies to.
  return createPortal(
    <CanvasWorkspaceProvider workspace={kind === '3d' ? '3d' : '2d'}>
      <AnisotropicFilteringProvider level={anisotropicFilteringLevel}>
        <WorldRootProvider value={portalScene}>
          <WorldEnvironmentScope world="subViewport">
            <CanvasSpaceProvider value={null}>{children}</CanvasSpaceProvider>
          </WorldEnvironmentScope>
        </WorldRootProvider>
      </AnisotropicFilteringProvider>
    </CanvasWorkspaceProvider>,
    portalScene
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
