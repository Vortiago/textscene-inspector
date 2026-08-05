/**
 * SubViewport — a canvas boundary that is not a world boundary (ADR-0033), and
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

import { useCallback, useEffect, useMemo } from 'react';
import { createPortal, useThree } from '@react-three/fiber';
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

export function SubViewport({ node, children }: NodeComponentProps) {
  const { own_world_3d: ownWorld3D } = node.properties as SubViewportProperties;
  const workspace = useCanvasWorkspace();
  const path = useNodePath() ?? node.name;
  // Classified over the RESOLVED subtree: in the parsed graph an `instance=`
  // child is a typeless, childless node, so an untouched 2D sub-scene and an
  // untouched 3D one are indistinguishable until the sub-scene lands.
  const kind = useViewportContentKind(node);

  // Only content this subsystem can rasterise gets an offscreen pass; Controls
  // are the native Control-raster pass's (`ControlRasterPass.tsx`), and an
  // empty viewport has nothing to draw.
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
 * scene, a registered pass) are never mounted for a sub-viewport that has no
 * WebGL source — a Control-only one publishes nothing at all here, leaving
 * the key to the native Control-raster pass (`ControlRasterPass.tsx`) that
 * owns it.
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
  // A STRETCHING `SubViewportContainer` overwrites its child viewport's size
  // with its own rect (`recalc_force_viewport_sizes` →
  // `set_size_force(get_size() / stretch_shrink)`), so the authored `size` is
  // dead for those. The container measures that rect in the DOM overlay and
  // publishes it here; no rect means no stretching container, and the authored
  // size stands — which is Godot's early return.
  const forcedRect = useViewportRect(path);
  const width = Math.max(1, Math.round(forcedRect?.x ?? size?.x ?? 512));
  const height = Math.max(1, Math.round(forcedRect?.y ?? size?.y ?? 512));

  const gl = useThree((state) => state.gl);
  const mainScene = useThree((state) => state.scene);
  const portalScene = useMemo(() => {
    const scene = new THREE.Scene();
    scene.name = `${node.name}::offscreen`;
    return scene;
  }, [node.name]);

  // Carries the storage contract AND the tonemap contract — Godot tonemaps a
  // sub-viewport's render into its target exactly as it tonemaps the main
  // view's, and `createOffscreenTarget` is where three is made to agree.
  const target = useMemo(
    () => createOffscreenTarget(width, height, node.name),
    [width, height, node.name]
  );

  useEffect(() => () => target.dispose(), [target]);

  // WebGL consumers sample this texture directly (no CPU round trip) — the
  // ordered pass driver runs every non-cyclic pass before R3F's own automatic
  // render each frame, so by the time anything samples it this frame's
  // content is already there, including on the very first frame this target
  // is published.
  // A persistent camera for 2D-world content. Godot draws a viewport's canvas
  // through its CANVAS TRANSFORM, which is the identity until a Camera2D in the
  // subtree makes itself current — so this starts at the whole target rect and
  // the pass narrows it to the current camera's view each frame.
  const orthoCamera = useMemo(() => new THREE.OrthographicCamera(), []);
  useEffect(() => {
    orthoCamera.near = 0.1;
    orthoCamera.far = 4000;
    applyOrthoFrame(orthoCamera, orthoFrameForSize({ x: width, y: height }));
  }, [orthoCamera, width, height]);

  // Every OTHER viewport boundary nested in this one's own subtree — this
  // pass's `dependsOn` for the ordered driver (`passOrder.ts`), since any of
  // them might be sampled by a `ViewportTexture` somewhere below and must
  // therefore render first.

  const renderPass = useCallback(() => {
    const source = rendersInline ? mainScene : portalScene;

    if (kind === '2d') {
      // The camera's world matrix is what carries an instanced sub-scene's
      // transform, and nothing has refreshed it yet this frame: `gl.render`
      // updates matrices, and this pass runs BEFORE the main one.
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

    // A perspective camera built by `<Camera3D>` carries the CANVAS aspect
    // (16:9); inside the viewport it frames the TARGET rect instead. Restored
    // straight after, because that same camera object may be the one the main
    // canvas is rendering through. This is the one piece of state only THIS
    // pass touches, so it stays here rather than inside the shared helper.
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
        // Godot tonemaps a viewport through ITS OWN world's environment
        // (`_render_buffers_post_process_and_tonemap` reads the environment the
        // viewport's `find_world_3d()` resolves). A shared world resolves to the
        // parent's, whose curve IS the renderer's current tonemap — leave it in
        // force. An own world is a fresh `World3D` with no Environment, and
        // Godot's default `tonemap_mode` is LINEAR — no curve. A 2D canvas is
        // never tonemapped at all: Godot draws canvas items into the target
        // AFTER the 3D tonemap pass.
        toneMapping: properties.own_world_3d || kind === '2d' ? THREE.NoToneMapping : undefined,
        // The consumer side re-tags this texture: `@react-three/fiber`'s
        // `applyProps` stamps `SRGBColorSpace` on any RGBA8/UnsignedByte texture
        // assigned to a colour-map prop, and the published target lands on an
        // albedo `map` exactly like a file texture. With `isXRRenderTarget` set,
        // three reads THIS pass's output space from the tag per draw, so the
        // stamp would bake an sRGB OETF into the offscreen render on top of the
        // tonemap (measured: the whole target 1.5–6.5x too bright in linear
        // terms). The stamp lands during React commits; re-asserting right
        // before the bind means no offscreen render ever runs under it.
        beforeBind: () => {
          target.texture.colorSpace = THREE.LinearSRGBColorSpace;
        },
        // No camera is not an error — Godot renders the clear colour and nothing
        // else, which is what an unrendered viewport looks like there too.
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

  usePublishViewportPass({ path, node, texture: target.texture, width, height, render: renderPass });

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
