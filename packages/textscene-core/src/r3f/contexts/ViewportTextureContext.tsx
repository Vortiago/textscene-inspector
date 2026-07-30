/**
 * Registry of sub-viewport render targets, keyed by scene-tree node path — the
 * seam between a `SubViewport` that renders offscreen and everything that
 * displays what it rendered (ADR-0030).
 *
 * Deliberately the same shape as the **AnimationDriverRegistry**: that registry
 * exists because an AnimationTree resolves a NodePath to a driver another node
 * published, and this is the same problem — a `ViewportTexture` resolves a
 * NodePath to a target a `SubViewport` published. Two contexts for the same
 * reason: the REGISTER function is stable so a publishing sub-viewport's effect
 * doesn't re-fire every time the map changes, and the MAP is reactive so a
 * consumer re-renders when its target appears (targets arrive after first
 * paint, like async-loaded resources). Both hooks are null-safe, so the linter
 * bundle and isolated tests mount without a provider.
 *
 * A sub-viewport has two kinds of consumer with incompatible needs, which is
 * why an entry is not a bare texture:
 *
 *  - **WebGL consumers** (`StandardMaterial3D.albedo_texture`, `Sprite2D`,
 *    `TextureRect`) sample `texture` directly.
 *  - **The DOM overlay surface** (`SubViewportContainer`) cannot sample a WebGL
 *    texture at all — the Control overlay is HTML (ADR-0003) — so it takes CPU
 *    pixels via `readPixels` and paints them into a `<canvas>`.
 *
 * Serving both from one publisher is what lets a consumer stay ignorant of
 * whether the target was produced by 3D content, 2D-canvas content, or a
 * rasterized Control subtree.
 */

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type * as THREE from 'three';

export interface ViewportTextureEntry {
  /** The rendered target, for consumers that sample it in the WebGL canvas. */
  texture: THREE.Texture;
  /** Target size in pixels — the rect the sub-viewport's content was laid out against. */
  size: { x: number; y: number };
  /**
   * Snapshot the target into CPU pixels, for DOM consumers that cannot sample a
   * WebGL texture. Returns null when the target is not yet rendered or the
   * read is unavailable; callers must treat null as "not ready", never as empty.
   */
  readPixels?: () => ImageData | null;
}

/** Publish the target at `path`; returns a cleanup that unregisters it. */
export type RegisterViewportTexture = (path: string, entry: ViewportTextureEntry) => () => void;

const NO_OP_REGISTER: RegisterViewportTexture = () => () => {};
const EMPTY: ReadonlyMap<string, ViewportTextureEntry> = new Map();

const RegisterViewportTextureContext =
  createContext<RegisterViewportTexture>(NO_OP_REGISTER);
RegisterViewportTextureContext.displayName = 'RegisterViewportTextureContext';

const ViewportTexturesContext =
  createContext<ReadonlyMap<string, ViewportTextureEntry>>(EMPTY);
ViewportTexturesContext.displayName = 'ViewportTexturesContext';

/** Stable publisher, for `<SubViewport>`. */
export function useRegisterViewportTexture(): RegisterViewportTexture {
  return useContext(RegisterViewportTextureContext);
}

/** Reactive lookup: the target published at `path`, or null. */
export function useViewportTexture(path: string | null): ViewportTextureEntry | null {
  const targets = useContext(ViewportTexturesContext);
  return path === null ? null : targets.get(path) ?? null;
}

export function ViewportTextureProvider({ children }: { children: ReactNode }) {
  const [targets, setTargets] = useState<ReadonlyMap<string, ViewportTextureEntry>>(
    () => new Map()
  );

  const registerViewportTexture = useCallback<RegisterViewportTexture>((path, entry) => {
    setTargets((prev) => {
      const next = new Map(prev);
      next.set(path, entry);
      return next;
    });
    return () => {
      setTargets((prev) => {
        // Only delete if THIS entry is still the registered one, so a remount
        // that re-registers before the old cleanup fires isn't clobbered.
        if (prev.get(path) !== entry) return prev;
        const next = new Map(prev);
        next.delete(path);
        return next;
      });
    };
  }, []);

  return (
    <RegisterViewportTextureContext.Provider value={registerViewportTexture}>
      <ViewportTexturesContext.Provider value={targets}>
        {children}
      </ViewportTexturesContext.Provider>
    </RegisterViewportTextureContext.Provider>
  );
}
