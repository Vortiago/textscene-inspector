/**
 * Publishing a sub-viewport's rendered content is ONE act with two halves, and
 * this hook is where both live so a publisher cannot perform one without the
 * other.
 *
 * A publisher must announce its texture (so `ViewportTexture` consumers can
 * resolve it by node path) AND its pass (so the orchestrator knows what to
 * drive, and what that render samples first). Wiring those as two independent
 * effects at each call site let a publisher register a texture nothing ever
 * renders into, or a pass nothing can sample — with nothing linking the two.
 *
 * `dependsOn` is derived here rather than passed in: it is always "the viewport
 * boundaries nested inside this node", so no caller should be choosing it.
 *
 * Lives beside `nestedViewportPaths` rather than in the registry contexts
 * because it knows about the parsed node tree, and those contexts deliberately
 * do not.
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
