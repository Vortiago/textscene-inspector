/**
 * useTileSetModel — resolves a tile node's `tile_set` reference into the
 * normalized TileSetModel, from either home a TileSet lives in:
 *   - `SubResource("…")` — embedded in the scene; resolved synchronously
 *     against the scene's internal/external resources (never `pending`).
 *   - `ExtResource("…")` / `res://…` — an external .tres file; fetched via
 *     useResource('Resource') (the generic .tres processor) and resolved
 *     against the file's own ext/sub sections. Missing-file panel rows and
 *     late-arrival upload recovery come from useResource.
 *
 * Hook-call count is constant: the sync branches feed `''` to useResource
 * (the documented no-request idiom).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { warn } from '../logger';
import type { ParsedResource } from '../parser/parsedResource';
import { parseResourceReference, resolveExtResourcePath } from '../resources/SubResourceResolver';
import { tileSetFromScene, tileSetFromTres } from '../resources/tileset/decode';
import type { TileSetModel } from '../resources/tileset/types';
import { useResource, useResourceLoader } from '../resources/useResource';
import { useSceneResources } from './SceneResourcesContext';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types';

export interface TileSetModelResult {
  model: TileSetModel | null;
  status: 'pending' | 'loaded' | 'unavailable';
}

export function useTileSetModel(tileSetRef: string | undefined): TileSetModelResult {
  const { internalResources, externalResources } = useSceneResources();

  const ref = tileSetRef ? parseResourceReference(tileSetRef) : null;
  const isExternal = !!tileSetRef && (ref?.type === 'ExtResource' || tileSetRef.startsWith('res://'));
  const resolvedPath = isExternal ? resolveExtResourcePath(tileSetRef, externalResources) : null;
  // Only text resources can ever parse; requesting e.g. a binary `.res`
  // TileSet would park the load in-flight forever (no processor handles it).
  const tresPath = resolvedPath?.endsWith('.tres') ? resolvedPath : null;
  const tresResult = useResource<ParsedResource>(tresPath ?? '', 'Resource');

  return useMemo((): TileSetModelResult => {
    if (!tileSetRef) return { model: null, status: 'unavailable' };

    if (ref?.type === 'SubResource') {
      const model = tileSetFromScene(tileSetRef, internalResources, externalResources);
      return model ? { model, status: 'loaded' } : { model: null, status: 'unavailable' };
    }

    if (resolvedPath && !tresPath) {
      warn(`[TileSet] "${resolvedPath}" is not a text resource (.tres) — cannot resolve TileSet`);
      return { model: null, status: 'unavailable' };
    }
    if (!tresPath) return { model: null, status: 'unavailable' };
    if (tresResult.status === 'pending') return { model: null, status: 'pending' };
    if (tresResult.status === 'unavailable' || !tresResult.value) {
      return { model: null, status: 'unavailable' };
    }
    const model = tileSetFromTres(tresResult.value);
    return model ? { model, status: 'loaded' } : { model: null, status: 'unavailable' };
  }, [tileSetRef, ref?.type, internalResources, externalResources, resolvedPath, tresPath, tresResult.status, tresResult.value]);
}

/**
 * The same resolution for SEVERAL refs at once — one `TileSetModelResult` per
 * distinct `tile_set`.
 *
 * A hook cannot be called in a loop, and one y-sort root can hold several
 * `TileMapLayer`s with DIFFERENT tilesets: resolving the first and bucketing
 * every layer's cells against it sorts the others at the wrong tile pitch, so
 * their rows interleave with their siblings at the wrong Y. Reads the loader's
 * cache directly and re-derives on its own events, the way `buildSolveTree`
 * does for the same reason.
 */
export function useTileSetModels(
  refs: readonly (string | undefined)[]
): (ref: string | undefined) => TileSetModelResult {
  const { internalResources, externalResources } = useSceneResources();
  const loader = useResourceLoader();
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const bus = loader?.eventBus;
    if (!bus) return undefined;
    const bump = () => setGeneration((g) => g + 1);
    bus.on('resource', 'loaded', bump);
    bus.on('resource', 'failed', bump);
    return () => {
      bus.off('resource', 'loaded', bump);
      bus.off('resource', 'failed', bump);
    };
  }, [loader]);

  const distinct = useMemo(
    () => [...new Set(refs.filter((ref): ref is string => !!ref))].sort(),
    // A fresh array every render otherwise; the JOINED value is the identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refs.filter(Boolean).join('\u0000')]
  );

  const pending = useMemo(() => {
    const paths: string[] = [];
    for (const ref of distinct) {
      const path = externalTresPath(ref, externalResources);
      if (path && loader && loader.resources.getCached(path) === undefined) paths.push(path);
    }
    return paths;
  }, [distinct, externalResources, loader]);

  // After render, not during it — `useResource`'s own convention.
  useEffect(() => {
    if (!loader) return;
    for (const path of pending) loader.resources.request(path);
  }, [loader, pending]);

  const resolved = useMemo(() => {
    const out = new Map<string, TileSetModelResult>();
    for (const ref of distinct) {
      out.set(ref, resolveTileSetModel(ref, internalResources, externalResources, loader));
    }
    return out;
    // `generation` is an intentional cache-buster: the loader's cache changed
    // under us. Its value is not read in the callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distinct, internalResources, externalResources, loader, generation]);

  // Stable while the resolution is: a caller memoises its expansion on this.
  return useCallback(
    (ref) => (ref ? resolved.get(ref) ?? UNAVAILABLE : UNAVAILABLE),
    [resolved]
  );
}

const UNAVAILABLE: TileSetModelResult = { model: null, status: 'unavailable' };

/** The `.tres` an external ref names, or null for a SubResource / non-text one. */
function externalTresPath(
  ref: string,
  externalResources: readonly TscnExternalResource[]
): string | null {
  const parsed = parseResourceReference(ref);
  const isExternal = parsed?.type === 'ExtResource' || ref.startsWith('res://');
  if (!isExternal) return null;
  const path = resolveExtResourcePath(ref, externalResources);
  return path?.endsWith('.tres') ? path : null;
}

function resolveTileSetModel(
  ref: string,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[],
  loader: ReturnType<typeof useResourceLoader>
): TileSetModelResult {
  if (parseResourceReference(ref)?.type === 'SubResource') {
    const model = tileSetFromScene(ref, internalResources, externalResources);
    return model ? { model, status: 'loaded' } : UNAVAILABLE;
  }
  const path = externalTresPath(ref, externalResources);
  if (!path || !loader) return UNAVAILABLE;
  const cached = loader.resources.getCached(path);
  if (cached === undefined) return { model: null, status: 'pending' };
  if (cached === null) return UNAVAILABLE;
  const model = tileSetFromTres(cached);
  return model ? { model, status: 'loaded' } : UNAVAILABLE;
}
