/**
 * Sub-viewport render targets by node path, the seam between an offscreen
 * `SubViewport` and what displays it (ADR-0033). As with the
 * **AnimationDriverRegistry**, the register function is stable and the map is
 * reactive, since targets arrive after first paint. Both work without a provider.
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type * as THREE from 'three';

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

/** Publishes the target at `path` and returns the cleanup. */
type RegisterViewportTexture = (path: string, entry: ViewportTextureEntry) => () => void;

const NO_OP_REGISTER: RegisterViewportTexture = () => () => {};
const EMPTY: ReadonlyMap<string, ViewportTextureEntry> = new Map();

const RegisterViewportTextureContext = createContext<RegisterViewportTexture>(NO_OP_REGISTER);
RegisterViewportTextureContext.displayName = 'RegisterViewportTextureContext';

const ViewportTexturesContext = createContext<ReadonlyMap<string, ViewportTextureEntry>>(EMPTY);
ViewportTexturesContext.displayName = 'ViewportTexturesContext';

/** Stable publisher, for `<SubViewport>`. */
function useRegisterViewportTexture(): RegisterViewportTexture {
  return useContext(RegisterViewportTextureContext);
}

/**
 * Publishes `entry` at `path`, the one key a `viewport_path` walks to: a consumer
 * resolves a `%Name` through its claim table to the claimant's own path. One hook
 * serves every publisher, so a consumer never knows which host produced its target.
 */
export function usePublishViewportTexture(path: string, entry: ViewportTextureEntry): void {
  const register = useRegisterViewportTexture();
  useEffect(() => register(path, entry), [register, path, entry]);
}

/** The target published at `path`, or null. */
export function useViewportTexture(path: string | null): ViewportTextureEntry | null {
  const targets = useContext(ViewportTexturesContext);
  return path === null ? null : (targets.get(path) ?? null);
}

export function ViewportTextureProvider({ children }: { children: ReactNode }) {
  const [targets, setTargets] = useState<ReadonlyMap<string, ViewportTextureEntry>>(() => new Map());

  const registerViewportTexture = useCallback<RegisterViewportTexture>((path, entry) => {
    setTargets((prev) => {
      const next = new Map(prev);
      next.set(path, entry);
      return next;
    });
    return () => {
      setTargets((prev) => {
        // Only this exact entry, so a remount that re-registered first survives.
        if (prev.get(path) !== entry) return prev;
        const next = new Map(prev);
        next.delete(path);
        return next;
      });
    };
  }, []);

  return (
    <RegisterViewportTextureContext.Provider value={registerViewportTexture}>
      <ViewportTexturesContext.Provider value={targets}>{children}</ViewportTexturesContext.Provider>
    </RegisterViewportTextureContext.Provider>
  );
}
