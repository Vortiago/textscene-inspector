/**
 * SubViewport: a canvas boundary that is not a world boundary (ADR-0033), and the
 * publisher of its own offscreen render target. Godot resolves `World3D` up to the
 * parent viewport unless `own_world_3d` is set, while `World2D` is always its own,
 * so Node3D descendants draw in the parent's view and CanvasItem descendants do not.
 */

import { useCallback, useEffect, useMemo } from 'react';
import { createPortal, useThree } from '@react-three/fiber';
import { CanvasSpaceProvider } from '../../../r3f/canvasRootScope';
import * as THREE from 'three';

import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import {
  CanvasWorkspaceProvider,
  useCanvasWorkspace,
} from '../../../r3f/contexts/CanvasWorkspaceContext';
import { useViewportRect } from '../../../r3f/contexts/ViewportRectContext';
import { Node } from '../../node/Component';
import {
  applyOrthoFrame,
  createOffscreenTarget,
  godotCanvasPosition,
  renderToOffscreenTarget,
  orthoFrameForCamera2D,
  orthoFrameForSize,
  selectViewportCamera,
  selectViewportCamera2D,
  viewportAspect,
} from './offscreenViewport';
import type { Camera2DTag } from '../../2d/camera2d/cameraView';
import { useViewportContentKind } from './useViewportContentKind';
import { usePublishViewportPass } from './usePublishViewportPass';
import type { SubViewportProperties } from './types';
import { MAX_TEXTURE_EXTENT } from '../../../r3f/webglLimits.js';

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
  const rendersInline = rasterizes
    ? kind === '3d' && !ownWorld3D && workspace === '3d'
    : !ownWorld3D;

  return (
    <Node node={node}>
      {rendersInline ? children : null}
      {rasterizes ? (
        <OffscreenViewport node={node} path={path} kind={kind} rendersInline={rendersInline}>
          {rendersInline ? null : children}
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
 * The render target's axis. Godot floors a viewport at 2 (`viewport.cpp:1120`,
 * `p_size.maxi(2)`) and leaves the ceiling to the GPU driver, but a file Godot
 * opens can hand `THREE.WebGLRenderTarget` a 2000000000-pixel axis.
 */
export function allocatableExtent(raw: number): number {
  const rounded = Math.round(raw);
  if (!Number.isFinite(rounded)) return 2;
  return Math.min(MAX_TEXTURE_EXTENT, Math.max(2, rounded));
}

/**
 * Owns the render target, drives the offscreen pass and publishes the result.
 * A separate component, so a Control-only sub-viewport mounts none of its hooks
 * and leaves the key to `ControlRasterPass.tsx`.
 */
function OffscreenViewport({
  node,
  path,
  kind,
  rendersInline,
  children,
}: OffscreenViewportProps) {
  const properties = node.properties as SubViewportProperties;
  const { size, transparent_bg: transparentBg } = properties;
  // A stretching `SubViewportContainer` overwrites the size with its own rect
  // (`recalc_force_viewport_sizes`: `set_size_force(get_size() / stretch_shrink)`),
  // measured in the DOM overlay and published here. No rect means no stretching
  // container, so the authored size stands, as in Godot's early return.
  const forcedRect = useViewportRect(path);
  const width = allocatableExtent(forcedRect?.x ?? size?.x ?? 512);
  const height = allocatableExtent(forcedRect?.y ?? size?.y ?? 512);

  const gl = useThree((state) => state.gl);
  const mainScene = useThree((state) => state.scene);
  const portalScene = useMemo(() => {
    const scene = new THREE.Scene();
    scene.name = `${node.name}::offscreen`;
    return scene;
  }, [node.name]);

  // Carries the storage and the tonemap contracts: Godot tonemaps a
  // sub-viewport's render into its target as it tonemaps the main view's.
  const target = useMemo(
    () => createOffscreenTarget(width, height, node.name),
    [width, height, node.name]
  );

  useEffect(() => () => target.dispose(), [target]);

  // A persistent camera for 2D-world content. Godot draws a viewport's canvas
  // through its canvas transform, the identity until a Camera2D in the subtree
  // makes itself current, so this starts at the whole target rect and the pass
  // narrows it to the current camera's view each frame.
  const orthoCamera = useMemo(() => new THREE.OrthographicCamera(), []);
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

    const camera =
      kind === '3d' ? selectViewportCamera(source, path) : orthoCamera;

    // A `<Camera3D>` perspective camera carries the canvas aspect (16:9). Inside
    // the viewport it frames the target rect, and it is restored after, since
    // the main canvas may render through the same camera. Only this pass touches
    // that state, so it stays out of the shared helper.
    const perspective = camera as THREE.PerspectiveCamera | null;
    const restoreAspect = perspective?.isPerspectiveCamera ? perspective.aspect : null;
    if (perspective?.isPerspectiveCamera) {
      perspective.aspect = viewportAspect({ x: width, y: height });
      perspective.updateProjectionMatrix();
    }

    try {
      renderToOffscreenTarget(gl, {
        target,
        transparentBg,
        // Godot tonemaps through the environment `find_world_3d()` resolves. A
        // shared world's curve is the renderer's current one. An own world has no
        // Environment, so LINEAR. Canvas items draw after the 3D tonemap pass, so
        // a 2D canvas gets none.
        toneMapping: properties.own_world_3d || kind === '2d' ? THREE.NoToneMapping : undefined,
        // `applyProps` stamps `SRGBColorSpace` on a texture bound to an albedo
        // `map`. With `isXRRenderTarget`, three reads this pass's output space
        // from that tag, so the stamp would add an sRGB OETF (1.5-6.5x too bright).
        // Re-tagged before every bind, since the stamp lands during React commits.
        beforeBind: () => {
          target.texture.colorSpace = THREE.LinearSRGBColorSpace;
        },
        // No camera is not an error: Godot renders the clear colour and nothing else.
        draw: () => {
          if (camera) gl.render(source, camera);
        },
      });
    } finally {
      if (perspective?.isPerspectiveCamera && restoreAspect !== null) {
        perspective.aspect = restoreAspect;
        perspective.updateProjectionMatrix();
      }
    }
  }, [
    rendersInline,
    mainScene,
    portalScene,
    kind,
    path,
    orthoCamera,
    gl,
    target,
    transparentBg,
    properties.own_world_3d,
    width,
    height,
  ]);

  // Consumers sample the texture directly. The ordered driver runs every
  // non-cyclic pass before R3F's own render, so a sampler sees this frame's
  // content, even on the frame the target is first published.
  usePublishViewportPass({ path, node, texture: target.texture, width, height, render: renderPass });

  if (rendersInline) return null;
  // The portal declares the workspace its content needs, not the host's, which
  // could drop it. The portal scene is detached, so no host CanvasItem transform
  // reaches it and a canvas root inside cancels nothing (`canvasRootScope.tsx`).
  return createPortal(
    <CanvasWorkspaceProvider workspace={kind === '3d' ? '3d' : '2d'}>
      <CanvasSpaceProvider value={null}>{children}</CanvasSpaceProvider>
    </CanvasWorkspaceProvider>,
    portalScene
  );
}
