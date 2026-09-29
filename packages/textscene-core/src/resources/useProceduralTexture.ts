/**
 * The React side of `proceduralTextureCache`: a mounted component borrows a shared procedural
 * texture by pinning it. Resolving and pinning are one operation, since an overflowing cache
 * disposes an unpinned entry and the consumer, whose memo deps never changed, samples a dead texture.
 * A texture that builds as a worker job is started here, and its slot keeps the texture it
 * had until the new one lands, as Godot keeps the old image while `noise_thread` runs.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type * as THREE from 'three';
import type { TscnInternalResource } from '../parser/types.js';
import { inThreadJobRunner } from '../workers/WorkerJobRunner.js';
import { usePendingWhile } from './usePendingWhile.js';
import { beginTextureWork } from './textures/textureWork.js';
import { useResourceLoader } from './useResource.js';
import type { ProceduralTextureLookup } from './textures/proceduralBuilds.js';
import { resolveProceduralTexture } from './textures/resolveProceduralTexture.js';
import {
  pinProceduralTexture,
  unpinProceduralTexture,
} from './textures/proceduralTextureCache.js';

/** One slot's procedural texture. */
export interface ProceduralSlot {
  /** The texture to draw: the built one, or while a build runs, the one the slot had before. */
  texture: THREE.Texture | null;
  /** The reference names a procedural texture, so no path resolver should look for it. */
  claimed: boolean;
  /** A build for this slot is still running. */
  pending: boolean;
}

interface Shown {
  texture: THREE.Texture;
  key: string;
}

const UNCLAIMED: ProceduralSlot = { texture: null, claimed: false, pending: false };

/**
 * The procedural texture a `SubResource` ref names, held resident while the caller is mounted.
 * Unclaimed for every other form, which the caller's async path handles. `resolveProceduralTexture`
 * decides which types count. A Texture2D slot reads through here or `useTexture2D`, since a
 * path resolver finds no path for a procedural texture.
 */
export function useProceduralTexture(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): ProceduralSlot {
  return useProceduralTextures([ref], internalResources)[0] ?? UNCLAIMED;
}

/** {@link useProceduralTexture} for several slots at once, one result per ref, in order. */
export function useProceduralTextures(
  refs: readonly (string | undefined)[],
  internalResources: readonly TscnInternalResource[]
): ProceduralSlot[] {
  // Keyed on the refs' text: callers rebuild the array every render.
  const refsText = JSON.stringify(refs);
  const lookups = useMemo(
    () => lookupAll(JSON.parse(refsText) as (string | null)[], internalResources),
    [refsText, internalResources]
  );
  // Builds that finished after `lookups` read the cache. Scoped to those lookups: a new
  // read of the cache answers for itself, and an entry evicted since is never shown.
  const [landed, setLanded] = useState<Landed>(NOTHING_LANDED);
  const landedTextures = landed.lookups === lookups ? landed.textures : NOTHING_LANDED.textures;
  const [failedKeys, setFailedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [buildError, setBuildError] = useState<{ error: unknown } | null>(null);
  if (buildError) throw buildError.error;

  const builds = useMemo(
    () =>
      lookups
        .filter(isPendingBuild)
        .filter((lookup) => !failedKeys.has(lookup.key) && !landedTextures.has(lookup.key)),
    [lookups, failedKeys, landedTextures]
  );

  /** Written after each commit: the textures the slots showed, kept while a new build runs. */
  const lastShown = useRef<readonly (Shown | null)[]>([]);
  const shown = lookups.map((lookup, slot): Shown | null => {
    if (lookup === null || failedKeys.has(lookup.key)) return null;
    if (lookup.status === 'ready') return { texture: lookup.texture, key: lookup.key };
    const built = landedTextures.get(lookup.key);
    return built ? { texture: built, key: lookup.key } : (lastShown.current[slot] ?? null);
  });
  useEffect(() => {
    lastShown.current = shown;
  });

  /**
   * Written when a build lands. Each end keeps the texture work counted until the commit
   * that shows the texture, where a draw site's upload takes the work over.
   */
  const handoffs = useRef<(() => void)[]>([]);
  useEffect(() => {
    handoffs.current.forEach((end) => end());
    handoffs.current = [];
  }, [landed, failedKeys]);
  useEffect(() => () => handoffs.current.forEach((end) => end()), []);

  const runner = useResourceLoader()?.jobRunner ?? inThreadJobRunner;
  useEffect(() => {
    let current = true;
    const handles = builds.map((build) => {
      const handle = build.start(runner);
      handle.settled.then(
        (texture) => {
          if (!current) return;
          handoffs.current.push(beginTextureWork());
          // Null while this effect still holds the build means it could not be allocated.
          if (texture) setLanded((prev) => landOne(prev, lookups, build.key, texture));
          else setFailedKeys((keys) => new Set(keys).add(build.key));
        },
        (error: unknown) => {
          if (current) setBuildError({ error });
        }
      );
      return handle;
    });
    return () => {
      current = false;
      handles.forEach((handle) => handle.release());
    };
  }, [builds, lookups, runner]);

  usePendingWhile(builds.length > 0);
  useProceduralTexturePins([
    ...shown.flatMap((entry) => (entry ? [entry.key] : [])),
    ...builds.map((build) => build.key),
  ]);

  return lookups.map((lookup, slot) => ({
    texture: shown[slot]?.texture ?? null,
    claimed: lookup !== null,
    pending: lookup !== null && builds.some((build) => build.key === lookup.key),
  }));
}

interface Landed {
  lookups: readonly (ProceduralTextureLookup | null)[] | null;
  textures: ReadonlyMap<string, THREE.Texture>;
}

const NOTHING_LANDED: Landed = { lookups: null, textures: new Map() };

/** `prev` with one more landed texture, restarted when it answered other lookups. */
function landOne(
  prev: Landed,
  lookups: readonly (ProceduralTextureLookup | null)[],
  key: string,
  texture: THREE.Texture
): Landed {
  const textures = new Map(prev.lookups === lookups ? prev.textures : []);
  return { lookups, textures: textures.set(key, texture) };
}

function lookupAll(
  refs: readonly (string | null)[],
  internalResources: readonly TscnInternalResource[]
): (ProceduralTextureLookup | null)[] {
  return refs.map((ref) => resolveProceduralTexture(ref ?? undefined, internalResources));
}

function isPendingBuild(
  lookup: ProceduralTextureLookup | null
): lookup is Extract<ProceduralTextureLookup, { status: 'pending' }> {
  return lookup?.status === 'pending';
}

/**
 * Holds every key resident while the caller is mounted, for a consumer with several procedural
 * slots. Keyed on the joined keys, not the array: an unpin and pin per render would flush the
 * disposals a pinned replace deferred. A key is `token:subResourceId` or a content key, whose
 * JSON escapes every newline, so it holds none.
 */
export function useProceduralTexturePins(keys: readonly string[]): void {
  const pinnedKeys = [...new Set(keys)].join('\n');
  useEffect(() => {
    if (!pinnedKeys) return undefined;
    const held = pinnedKeys.split('\n');
    held.forEach(pinProceduralTexture);
    return () => held.forEach(unpinProceduralTexture);
  }, [pinnedKeys]);
}
