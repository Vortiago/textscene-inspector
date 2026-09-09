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

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { TscnNode } from '../../parser/types.js';
import { useResourceLoader } from '../../resources/useResource.js';
import { cachedUniqueNameClaims, type UniqueNameClaim } from '../../utils/uniqueNames.js';
import { claimOwnerOf, ownerClaims } from '../uniqueNameOwner.js';
import { liveTreeContext, useLiveTreeVersion } from '../useLiveSceneTree.js';
import { viewportTextureUniqueNameKey } from '../viewportTexturePath.js';
import { useOptionalHierarchy } from './HierarchyContext.js';
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

/**
 * The resolved `%Name` table the node at `path` resolves against, or undefined
 * when no scene is in context.
 *
 * The flag on a node says it CLAIMED a name, not that it holds one — two nodes
 * may claim the same one and only the first keeps it. Resolving that needs the
 * whole authored tree, which the shell already has, so the answer is read from
 * there rather than guessed per publisher. Undefined outside the shell, where
 * there is no tree and the flag is all that is knowable.
 *
 * Per OWNER, not per scene: a name is registered on the claimant's owner
 * (node.cpp:2222-2234) and looked up through the caller's (node.cpp:1930-1938),
 * so a node inside an instanced sub-scene reads that sub-scene root's table
 * and an outer node never does. Without a path, the outer root's table — one
 * shared object per tree, so every consumer's lookup is a lookup rather than a
 * walk. With one, re-derived on the loader's version tick, since the owner of
 * a node inside a sub-scene is only knowable once that sub-scene has loaded;
 * without one there is nothing to re-derive, so no subscription either.
 */
export function useUniqueNameClaims(
  path?: string | null
): ReadonlyMap<string, UniqueNameClaim> | undefined {
  const graph = useOptionalHierarchy()?.sceneGraph;
  const loader = useResourceLoader();
  const version = useLiveTreeVersion(path ? loader : null);
  return useMemo(() => {
    const live = liveTreeContext(graph, loader);
    if (!live) return undefined;
    if (!path) return cachedUniqueNameClaims(live.roots);
    return ownerClaims(claimOwnerOf(path, live.roots, live.ctx));
    // `version` is the cache-buster for the loader's scene cache, which the
    // owner walk reads and which is mutated outside React.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, loader, version, path]);
}

/**
 * Publish `entry` for `node` at `path`, and at its `%UniqueName` spelling when it
 * claims one — the two keys a `viewport_path` can name the same viewport by.
 *
 * One hook rather than the same effect in each publisher: the WebGL and
 * DOM-raster hosts publish to the same registry, and a consumer is meant to stay
 * ignorant of which produced its target.
 */
export function usePublishViewportTexture(
  node: TscnNode,
  path: string,
  entry: ViewportTextureEntry
): void {
  const register = useRegisterViewportTexture();
  const claims = useUniqueNameClaims(path);
  // The derived key, not the node, so a re-parse that changes node identity
  // without changing the spelling does not withdraw and republish the target.
  const alias = viewportTextureUniqueNameKey(node, path, claims);
  useEffect(() => {
    const withdraw = [register(path, entry)];
    if (alias) withdraw.push(register(alias, entry));
    return () => {
      for (const fn of withdraw) fn();
    };
  }, [register, path, alias, entry]);
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
