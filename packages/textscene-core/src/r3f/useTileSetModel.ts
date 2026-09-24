/**
 * Resolve a tile node's `tile_set` into the normalised TileSetModel. A
 * `SubResource("…")` resolves synchronously, never `pending`. An `ExtResource("…")`
 * or `res://…` .tres loads through `useResource`, with its missing-file and upload
 * handling. The sync branches pass `''`, so the hook-call count is constant.
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
  // Only a text resource parses. No processor handles a binary `.res` TileSet,
  // so requesting one would park the load in flight.
  const tresPath = resolvedPath?.endsWith('.tres') ? resolvedPath : null;
  const tresResult = useResource<ParsedResource>(tresPath ?? '', 'resource');

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
 * The same resolution for several refs, one `TileSetModelResult` per distinct
 * `tile_set`: one y-sort root can hold layers with different tilesets, and a hook
 * cannot run in a loop. It reads the loader's cache and re-derives on its events.
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
    // A fresh array every render otherwise: the joined value is the identity.
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

  // After render, not during it: `useResource`'s own convention.
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
    // `generation` is a cache-buster: the callback never reads it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distinct, internalResources, externalResources, loader, generation]);

  // Stable while the resolution is: a caller memoises its expansion on this.
  return useCallback(
    (ref) => (ref ? resolved.get(ref) ?? UNAVAILABLE : UNAVAILABLE),
    [resolved]
  );
}

const UNAVAILABLE: TileSetModelResult = { model: null, status: 'unavailable' };

/** The `.tres` an external ref names, or null for a SubResource or a non-text one. */
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
