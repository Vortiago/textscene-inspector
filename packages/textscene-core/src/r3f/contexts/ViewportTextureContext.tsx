/**
 * Sub-viewport render targets by node path, the seam between an offscreen
 * `SubViewport` and what displays it (ADR-0033). The map is a store, not a context value, since
 * every Texture2D slot reads it and a publish re-renders only the readers of its path. Both work
 * without a provider.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type * as THREE from 'three';
import {
  createExternalStore,
  useExternalStoreSelection,
  useExternalStoreValue,
  type ExternalStore,
} from '../hooks/createExternalStore.js';

/**
 * A target carries Godot's two views of one storage (`scene/main/viewport.cpp:168-172`,
 * `texture_storage.cpp:1145-1156`). Every consumer samples them in the canvas that rendered them,
 * a Control subtree's included (`nodes/viewport/subviewport/ControlRasterPass.tsx`).
 */
export interface ViewportTextureEntry {
  /**
   * The plain view, which a canvas item and a raw material slot sample. It holds sRGB bytes, which
   * the canvas filters raw (`texture_storage.cpp:754`).
   */
  plain: TargetView;
  /** The sRGB view, which a `source_color` slot samples (`material_storage.cpp:1067,1073`). */
  decoding: TargetView;
  /** The size in pixels that the sub-viewport's content was laid out against. */
  size: { x: number; y: number };
}

/**
 * One view of a target. WebGL2 has no texture views, so a pass may serve a view as a copy, which it
 * fills only while a consumer retains it.
 */
export interface TargetView {
  texture: THREE.Texture;
  /** Keeps the view filled until the returned release is called. A second release changes nothing. */
  retain(): () => void;
}

type ViewportTargets = ReadonlyMap<string, ViewportTextureEntry>;

const EMPTY: ViewportTargets = new Map();

/** Without a provider, a publish sets nothing and every read finds no target. */
const NO_PROVIDER: ExternalStore<ViewportTargets> = {
  get: () => EMPTY,
  set: () => {},
  subscribe: () => () => {},
};

/** Written only by `registerTarget`, through a provider's own store. */
const TargetsContext = createContext<ExternalStore<ViewportTargets>>(NO_PROVIDER);
TargetsContext.displayName = 'ViewportTexturesContext';

/**
 * Publishes `entry` at `path`, the one key a `viewport_path` walks to: a consumer
 * resolves a `%Name` through its claim table to the claimant's own path. One hook
 * serves every publisher, so a consumer never knows which host produced its target.
 */
export function usePublishViewportTexture(path: string, entry: ViewportTextureEntry): void {
  const targets = useContext(TargetsContext);
  useEffect(() => registerTarget(targets, path, entry), [targets, path, entry]);
}

/** Sets `entry` at `path` in `targets`, and returns the cleanup. */
function registerTarget(
  targets: ExternalStore<ViewportTargets>,
  path: string,
  entry: ViewportTextureEntry
): () => void {
  targets.set(new Map(targets.get()).set(path, entry));
  return () => {
    // Only this exact entry, so a remount that re-registered first survives.
    if (targets.get().get(path) !== entry) return;
    const next = new Map(targets.get());
    next.delete(path);
    targets.set(next);
  };
}

/** The target published at `path`, or null. A reader of no path never re-renders. */
export function useViewportTexture(path: string | null): ViewportTextureEntry | null {
  return useExternalStoreSelection(useContext(TargetsContext), (targets) =>
    path === null ? null : (targets.get(path) ?? null)
  );
}

/** Every published target, by path, for a reader that resolves many paths outside a hook. */
export function useViewportTextures(): ViewportTargets {
  return useExternalStoreValue(useContext(TargetsContext));
}

export function ViewportTextureProvider({ children }: { children: ReactNode }) {
  const [targets] = useState(() => createExternalStore(EMPTY));
  return <TargetsContext.Provider value={targets}>{children}</TargetsContext.Provider>;
}
