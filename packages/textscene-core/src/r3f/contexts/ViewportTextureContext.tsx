/**
 * Sub-viewport render targets by node path, the seam between an offscreen
 * `SubViewport` and what displays it (ADR-0033). As with the
 * **AnimationDriverRegistry**, the register function is stable and the map is
 * reactive, since targets arrive after first paint. Both work without a provider.
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
import {
  cachedUniqueNameClaims,
  uniqueNameLivePaths,
  type UniqueNameClaim,
} from '../../utils/uniqueNames.js';
import { claimOwnerOf, ownerClaims } from '../uniqueNameOwner.js';
import { liveTreeContext, useLiveTreeVersion } from '../useLiveSceneTree.js';
import { viewportTextureUniqueNameKey } from '../viewportTexturePath.js';
import { useOptionalHierarchy } from './HierarchyContext.js';
import type * as THREE from 'three';

export interface ViewportTextureEntry {
  /**
   * The rendered target. Every consumer samples it in the canvas that rendered
   * it, a Control subtree's included (`nodes/viewport/subviewport/ControlRasterPass.tsx`).
   */
  texture: THREE.Texture;
  /** The size in pixels that the sub-viewport's content was laid out against. */
  size: { x: number; y: number };
}

/** Publishes the target at `path` and returns the cleanup. */
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
 * The `%Name` table the node at `path` resolves against, or undefined with no
 * scene. A flag says a node claimed a name, and only the first claimant keeps
 * it, so the answer needs the whole tree. It is per owner: a name registers on
 * the claimant's owner (node.cpp:2222-2234) and resolves through the caller's (node.cpp:1930-1938).
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
    // Without a path, the outer root's table, one shared object per tree. A
    // path re-derives on the version tick, since a sub-scene node's owner is
    // known only after the load.
    if (!path) return cachedUniqueNameClaims(live.roots);
    return ownerClaims(claimOwnerOf(path, live.roots, live.ctx));
    // `version` is the cache-buster for the loader's scene cache, which the
    // owner walk reads and which is mutated outside React.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, loader, version, path]);
}

/**
 * The `%Name` table the node at `path` resolves against, as the live paths the dispatcher
 * registers: the composed render tree spells a path as a claim's `livePath`. A rebuilt table with
 * the same entries keeps the old map, since a sub-scene owner's table is rebuilt on every load.
 */
export function useUniqueNamePaths(path: string | null): ReadonlyMap<string, string> | undefined {
  const claims = useUniqueNameClaims(path);
  const paths = useMemo(() => (claims ? uniqueNameLivePaths(claims) : undefined), [claims]);
  const signature = useMemo(() => (paths ? JSON.stringify([...paths]) : null), [paths]);
  // `signature` stands for `paths`: a new map with the same entries is the same answer.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => paths, [signature]);
}

/**
 * Publishes `entry` at `path`, and at its `%UniqueName` spelling when it claims
 * one: the two keys a `viewport_path` can use. One hook serves every publisher,
 * so a consumer never knows which host produced its target.
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

/** The target published at `path`, or null. */
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
      <ViewportTexturesContext.Provider value={targets}>
        {children}
      </ViewportTexturesContext.Provider>
    </RegisterViewportTextureContext.Provider>
  );
}
