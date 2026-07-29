/**
 * SubViewport — a canvas boundary that is not a world boundary (ADR-0030), and
 * the publisher of its own offscreen render target.
 *
 * Godot's `Viewport` always instantiates its own `World2D` but resolves
 * `World3D` by walking UP to the parent viewport unless `own_world_3d` is set
 * (`Viewport::find_world_2d` / `find_world_3d`). So a sub-viewport's Node3D
 * descendants really do draw in the parent's 3D view, while its CanvasItem
 * descendants never draw in the parent's canvas — measured through Godot 4.6.3,
 * not derived.
 *
 * Both halves fall out of the REGISTRATION rather than of any code here: the
 * slice registers with neither `canvasItem` nor `container`, so `PlainNode`'s
 * existing workspace branches pass it through in the 3D workspace and drop its
 * whole subtree in the 2D one.
 *
 * The offscreen pass adds one rule on top: **it renders the scene the subtree
 * is actually mounted in.** When the subtree draws inline (3D content, shared
 * world, 3D workspace) that is the main scene — which is also what Godot does,
 * since a shared `World3D` means the viewport renders the whole shared world,
 * environment included. Otherwise the subtree has no inline mount and is
 * portalled into a detached scene, which becomes the source. Either way the
 * subtree is mounted exactly ONCE: a second mount would register a second
 * Object3D at the same node path, and selection would resolve to the offscreen
 * copy.
 *
 * `disable_3d` is deliberately NOT consulted: it disables the viewport's own 3D
 * pass, and a probe render confirms it leaves the parent view untouched.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import {
  CanvasWorkspaceProvider,
  useCanvasWorkspace,
} from '../../../r3f/contexts/CanvasWorkspaceContext';
import {
  useRegisterViewportTexture,
  type ViewportTextureEntry,
} from '../../../r3f/contexts/ViewportTextureContext';
import { Node } from '../../node/Component';
import {
  DEFAULT_CLEAR_COLOR,
  orthoFrameForSize,
  selectViewportCamera,
  targetPixelsToImageData,
  viewportAspect,
} from './offscreenViewport';
import { viewportContentKind } from './viewportContent';
import type { SubViewportProperties } from './types';

export function SubViewport({ node, children }: NodeComponentProps) {
  const { own_world_3d: ownWorld3D } = node.properties as SubViewportProperties;
  const workspace = useCanvasWorkspace();
  const path = useNodePath() ?? node.name;
  const kind = useMemo(() => viewportContentKind(node), [node]);

  // Only content this subsystem can rasterise gets an offscreen pass; Controls
  // are the DOM rasterizer's, and an empty viewport has nothing to draw.
  const rasterizes = kind === '3d' || kind === '2d';

  // The subtree draws in the parent view exactly when all three hold: it is 3D
  // content, the world is shared, and this canvas draws 3D. Any other case has
  // no inline mount, so the offscreen pass supplies one via the portal.
  //
  // Without an offscreen pass the children have nowhere else to go, so they
  // keep passing through on the plain `own_world_3d` rule — a component must
  // render the children the dispatcher handed it (subtreeConformance), and a
  // Control subtree still has to reach the dispatcher that drops or draws it.
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
 * Owns the render target, drives the offscreen pass, and publishes the result.
 *
 * Split out from `<SubViewport>` so the hooks it needs (a target, a portal
 * scene, a per-frame render) are never mounted for a sub-viewport that has no
 * WebGL source — a Control-only one publishes nothing at all rather than a
 * cleared target, leaving the key to the DOM rasterizer that owns it.
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
  const width = Math.max(1, Math.round(size?.x ?? 512));
  const height = Math.max(1, Math.round(size?.y ?? 512));

  const gl = useThree((state) => state.gl);
  const mainScene = useThree((state) => state.scene);
  const registerViewportTexture = useRegisterViewportTexture();

  const portalScene = useMemo(() => {
    const scene = new THREE.Scene();
    scene.name = `${node.name}::offscreen`;
    return scene;
  }, [node.name]);

  const target = useMemo(() => {
    const created = new THREE.WebGLRenderTarget(width, height, {
      depthBuffer: true,
      stencilBuffer: false,
    });
    // The pass writes display-referred pixels, and every consumer samples the
    // result as a colour map — so the target stores sRGB and three's own
    // output conversion runs on the way in, exactly as it does for the canvas.
    created.texture.colorSpace = THREE.SRGBColorSpace;
    created.texture.name = `${node.name}::target`;
    // The sub-viewport's own filter enum is not reproduced; linear matches
    // Godot's default `canvas_item_default_texture_filter` (1, LINEAR).
    created.texture.minFilter = THREE.LinearFilter;
    created.texture.magFilter = THREE.LinearFilter;
    created.texture.generateMipmaps = false;
    return created;
  }, [width, height, node.name]);

  useEffect(() => () => target.dispose(), [target]);

  // Gates `readPixels`: a consumer must be able to tell "no frame yet" from
  // "rendered empty", and only the pass itself knows which it is.
  const hasRendered = useRef(false);
  useEffect(() => {
    hasRendered.current = false;
  }, [target]);

  const readPixels = useCallback((): ImageData | null => {
    if (!hasRendered.current) return null;
    const buffer = new Uint8Array(width * height * 4);
    try {
      gl.readRenderTargetPixels(target, 0, 0, width, height, buffer);
    } catch {
      // No real GL context (headless harnesses, a lost context) — "not ready",
      // which is exactly what null means here.
      return null;
    }
    return targetPixelsToImageData(buffer, width, height);
  }, [gl, target, width, height]);

  const entry = useMemo<ViewportTextureEntry>(
    () => ({ texture: target.texture, size: { x: width, y: height }, readPixels }),
    [target, width, height, readPixels]
  );

  useEffect(
    () => registerViewportTexture(path, entry),
    [registerViewportTexture, path, entry]
  );

  // A persistent camera for 2D-world content: Godot draws a viewport's canvas
  // through its canvas transform, with no camera node to borrow.
  const orthoCamera = useMemo(() => new THREE.OrthographicCamera(), []);
  useEffect(() => {
    const frame = orthoFrameForSize({ x: width, y: height });
    orthoCamera.left = frame.left;
    orthoCamera.right = frame.right;
    orthoCamera.top = frame.top;
    orthoCamera.bottom = frame.bottom;
    orthoCamera.near = 0.1;
    orthoCamera.far = 4000;
    orthoCamera.position.set(...frame.position);
    orthoCamera.updateProjectionMatrix();
  }, [orthoCamera, width, height]);

  // Default priority: a priority-0 subscriber runs BEFORE R3F's automatic main
  // render, so the target the main pass samples was filled this frame. Any
  // non-zero priority would also disable that automatic render entirely.
  useFrame(() => {
    const source = rendersInline ? mainScene : portalScene;
    const camera =
      kind === '3d' ? selectViewportCamera(source, path) : orthoCamera;

    const previousTarget = gl.getRenderTarget();
    const previousAlpha = gl.getClearAlpha();
    const previousColor = new THREE.Color();
    gl.getClearColor(previousColor);

    // A perspective camera built by `<Camera3D>` carries the CANVAS aspect
    // (16:9); inside the viewport it frames the TARGET rect instead. Restored
    // straight after, because that same camera object may be the one the main
    // canvas is rendering through.
    const perspective = camera as THREE.PerspectiveCamera | null;
    const restoreAspect = perspective?.isPerspectiveCamera ? perspective.aspect : null;
    if (perspective?.isPerspectiveCamera) {
      perspective.aspect = viewportAspect({ x: width, y: height });
      perspective.updateProjectionMatrix();
    }

    try {
      gl.setRenderTarget(target);
      gl.setClearColor(DEFAULT_CLEAR_COLOR, transparentBg ? 0 : 1);
      gl.clear(true, true, true);
      // No camera is not an error — Godot renders the clear colour and nothing
      // else, which is what an unrendered viewport looks like there too.
      if (camera) gl.render(source, camera);
      hasRendered.current = true;
    } finally {
      gl.setRenderTarget(previousTarget);
      gl.setClearColor(previousColor, previousAlpha);
      if (perspective?.isPerspectiveCamera && restoreAspect !== null) {
        perspective.aspect = restoreAspect;
        perspective.updateProjectionMatrix();
      }
    }
  });

  if (rendersInline) return null;
  // Inside its own target a sub-viewport draws its own content, whatever the
  // host canvas's workspace is — so the portal declares the workspace the
  // content needs rather than inheriting the one that would drop it.
  return createPortal(
    <CanvasWorkspaceProvider workspace={kind === '3d' ? '3d' : '2d'}>
      {children}
    </CanvasWorkspaceProvider>,
    portalScene
  );
}
