/**
 * Publishes a sub-viewport's texture, for `ViewportTexture` consumers, and its pass,
 * for the orchestrator, as one act: neither can exist without the other. It derives
 * `dependsOn` from the parsed tree itself, which the registry contexts do not read.
 */
import { useCallback, useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import type { TscnNode } from '../../../parser/types.js';
import { useRegisterViewportPass } from '../../../r3f/contexts/ViewportPassRegistryContext.js';
import {
  usePublishViewportTexture,
  type ViewportTextureEntry,
} from '../../../r3f/contexts/ViewportTextureContext.js';
import { collectNestedViewportPaths } from './nestedViewportPaths.js';
import { useTargetViews } from './targetViews.js';

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
  /**
   * This frame's offscreen render, which the copy views fill from after. Never called while
   * this pass sits in a cycle.
   */
  render: () => void;
}

export function usePublishViewportPass({
  path,
  node,
  target,
  width,
  height,
  isTransparent,
  render,
}: PublishViewportPassOptions): void {
  const registerViewportPass = useRegisterViewportPass();
  const views = useTargetViews(target, isTransparent);

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
  useEffect(
    () => registerViewportPass(path, { dependsOn, render: renderViews }),
    [registerViewportPass, path, dependsOn, renderViews]
  );
}
