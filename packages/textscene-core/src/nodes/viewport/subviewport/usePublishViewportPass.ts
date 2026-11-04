/**
 * Publishes a sub-viewport's texture, for `ViewportTexture` consumers, and its pass,
 * for the orchestrator, as one act: neither can exist without the other. It derives
 * `dependsOn` from the parsed tree itself, which the registry contexts do not read.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import type { TscnNode } from '../../../parser/types.js';
import {
  useRegisterViewportPass,
  type ViewportPass,
} from '../../../r3f/contexts/ViewportPassRegistryContext.js';
import {
  usePublishViewportTexture,
  type ViewportTextureEntry,
} from '../../../r3f/contexts/ViewportTextureContext.js';
import { TargetRenderState } from '../renderGate.js';
import { collectNestedViewportPaths } from './nestedViewportPaths.js';
import { clearTarget } from './offscreenViewport.js';
import { useTargetViews } from './targetViews.js';
import type { ViewportGate } from './viewportGate.js';

interface PublishViewportPassOptions {
  /** Dispatcher-absolute path of the sub-viewport publishing its content. */
  path: string;
  /** The publishing node, whose subtree names the passes this one samples. */
  node: TscnNode;
  /** The target whose plain view and decoding view consumers sample. */
  target: THREE.WebGLRenderTarget;
  width: number;
  height: number;
  /** `transparent_bg`: whether the target's image keeps alpha. */
  isTransparent: boolean;
  /** What the live tree says of the pass's update mode. */
  gate: ViewportGate;
  /** The renders of `target`, which `render` takes. */
  renderState: TargetRenderState;
  /**
   * This frame's offscreen render, which the copy views fill from after. Never called while
   * this pass sits in a cycle.
   */
  render: () => void;
}

/** The renders of `target`. A new target starts with none, as Godot's new target holds (0, 0, 0, 0) with its ONCE pending. */
export function useTargetRenderState(target: THREE.WebGLRenderTarget): TargetRenderState {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the state follows the target
  return useMemo(() => new TargetRenderState(), [target]);
}

export function usePublishViewportPass({
  path,
  node,
  target,
  width,
  height,
  isTransparent,
  gate,
  renderState,
  render,
}: PublishViewportPassOptions): void {
  const gl = useThree((state) => state.gl);
  const registerViewportPass = useRegisterViewportPass();
  const views = useTargetViews(target, isTransparent);
  // A layout effect, so a consumer that mounts beside this pass never samples the allocation's bytes.
  // A target that has rendered keeps its bytes when `transparent_bg` changes.
  useLayoutEffect(() => {
    if (!renderState.hasRendered) clearTarget(gl, target, isTransparent);
  }, [gl, target, isTransparent, renderState]);

  const entry = useMemo<ViewportTextureEntry>(
    () => ({ plain: views.plain, decoding: views.decoding, size: { x: width, y: height } }),
    [views, width, height]
  );
  usePublishViewportTexture(path, entry);

  const dependsOn = useMemo(() => collectNestedViewportPaths(node, path), [node, path]);
  const renderViews = useCallback(() => {
    render();
    views.fill();
  }, [render, views]);
  const viewportPass = useMemo<ViewportPass>(
    () => ({
      dependsOn,
      render: renderViews,
      gate: {
        ...gate,
        state: renderState,
        isSampled: views.isSampled,
        restart: (renderer) => {
          renderState.restart();
          clearTarget(renderer, target, isTransparent);
        },
      },
    }),
    [dependsOn, renderViews, gate, renderState, views, target, isTransparent]
  );
  useEffect(() => registerViewportPass(path, viewportPass), [registerViewportPass, path, viewportPass]);
}
