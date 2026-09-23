/**
 * Publishes a sub-viewport's texture, for `ViewportTexture` consumers, and its pass,
 * for the orchestrator, as one act: neither can exist without the other. It derives
 * `dependsOn` from the parsed tree itself, which the registry contexts do not read.
 */
import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import type { TscnNode } from '../../../parser/types.js';
import { useRegisterViewportPass } from '../../../r3f/contexts/ViewportPassRegistryContext.js';
import {
  usePublishViewportTexture,
  type ViewportTextureEntry,
} from '../../../r3f/contexts/ViewportTextureContext.js';
import { collectNestedViewportPaths } from './nestedViewportPaths.js';

export interface PublishViewportPassOptions {
  /** Dispatcher-absolute path of the sub-viewport publishing its content. */
  path: string;
  /** The publishing node, whose subtree names the passes this one samples. */
  node: TscnNode;
  /** The target texture consumers sample. */
  texture: THREE.Texture;
  width: number;
  height: number;
  /** This frame's offscreen render. Never called while this pass sits in a cycle. */
  render: () => void;
}

export function usePublishViewportPass({
  path,
  node,
  texture,
  width,
  height,
  render,
}: PublishViewportPassOptions): void {
  const registerViewportPass = useRegisterViewportPass();

  const entry = useMemo<ViewportTextureEntry>(
    () => ({ texture, size: { x: width, y: height } }),
    [texture, width, height]
  );
  // Through the shared publisher, which also registers the `%UniqueName`
  // spelling a `viewport_path` may name this viewport by (node.cpp:1930-1938).
  usePublishViewportTexture(node, path, entry);

  const dependsOn = useMemo(() => collectNestedViewportPaths(node, path), [node, path]);
  useEffect(
    () => registerViewportPass(path, { dependsOn, render }),
    [registerViewportPass, path, dependsOn, render]
  );
}
