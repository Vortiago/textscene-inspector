/**
 * The React side of `proceduralTextureCache`: a mounted component borrows a shared procedural
 * texture by pinning it. Resolving and pinning are one operation, since an overflowing cache
 * disposes an unpinned entry and the consumer, whose memo deps never changed, samples a dead texture.
 * A texture that builds as a worker job is started here, and its slot keeps the texture it
 * had until the new one lands, as Godot keeps the old image while `noise_thread` runs.
 */

import { useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import { inThreadJobRunner } from '../workers/WorkerJobRunner.js';
import { usePendingWhile } from './usePendingWhile.js';
import { textureWork } from './textures/textureWork.js';
import { useResourceLoader } from './useResource.js';
import { withKey } from '../utils/keySet.js';
import type { ProceduralTextureLookup } from './textures/proceduralBuilds.js';
import {
  pinProceduralTexture,
  releaseProceduralTextures,
  unpinProceduralTexture,
} from './textures/proceduralTextureCache.js';
import { releasedOnUnmount } from '../r3f/sharedTexture.js';

// The cache outlives every canvas, so a canvas that unmounts frees its textures from each renderer.
releasedOnUnmount({ dispose: releaseProceduralTextures });

/** One slot's procedural texture. */
export interface ProceduralSlot {
  /** The texture to draw: the built one, or while a build runs, the one the slot had before. */
  texture: THREE.Texture | null;
  /** The reference names a procedural texture, so no path resolver should look for it. */
  claimed: boolean;
  /** A build for the current reference is running. False once it lands or fails. */
  building: boolean;
}

interface Shown {
  texture: THREE.Texture;
  key: string;
}

/**
 * The texture `lookup` gives, held resident while the caller is mounted, and its build started
 * when it is pending. Unclaimed for no lookup, which the caller's other paths handle. The caller
 * keeps `lookup` in a memo on the decoded value it came from.
 */
export function useProceduralTexture(lookup: ProceduralTextureLookup | null): ProceduralSlot {
  // A build that finished after `lookup` read the cache. Scoped to that lookup: a new read of
  // the cache answers for itself, and an entry evicted since is never shown.
  const [landed, setLanded] = useState<Landed | null>(null);
  const landedTexture = landed?.lookup === lookup ? landed.texture : null;
  const [failedKeys, setFailedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [buildError, setBuildError] = useState<{ error: unknown } | null>(null);
  if (buildError) throw buildError.error;

  const hasFailed = lookup !== null && failedKeys.has(lookup.key);
  const build = lookup?.status === 'pending' && !hasFailed && !landedTexture ? lookup : null;

  /** Written after each commit: the texture the slot showed, kept while a new build runs. */
  const lastShown = useRef<Shown | null>(null);
  const shown = shownTexture(lookup, hasFailed, landedTexture, lastShown.current);
  useEffect(() => {
    lastShown.current = shown;
  });

  const runner = useResourceLoader()?.jobRunner ?? inThreadJobRunner;
  useEffect(() => {
    if (!build) return undefined;
    let current = true;
    const handle = build.start(runner);
    handle.settled.then(
      (texture) => {
        if (!current) return;
        // Null while this effect still holds the build means it could not be allocated.
        if (texture) setLanded({ lookup: build, texture });
        else setFailedKeys((keys) => withKey(keys, build.key));
      },
      (error: unknown) => {
        if (current) setBuildError({ error });
      }
    );
    return () => {
      current = false;
      handle.release();
    };
  }, [build, runner]);

  usePendingWhile(build !== null);
  useTextureWorkWhile(build !== null);
  useProceduralTexturePins([...(shown ? [shown.key] : []), ...(build ? [build.key] : [])]);

  return { texture: shown?.texture ?? null, claimed: lookup !== null, building: build !== null };
}

/** The texture the slot shows: the ready one, the landed build, or while a build runs, the last one. */
function shownTexture(
  lookup: ProceduralTextureLookup | null,
  hasFailed: boolean,
  landedTexture: THREE.Texture | null,
  lastShown: Shown | null
): Shown | null {
  if (lookup === null || hasFailed) return null;
  if (lookup.status === 'ready') return { texture: lookup.texture, key: lookup.key };
  return landedTexture ? { texture: landedTexture, key: lookup.key } : lastShown;
}

/**
 * Counts texture work while `isWorking`. A landed build stops being worked on in the commit that
 * shows its texture, where a draw site's upload starts, so the two effects run in one flush
 * and the count never reads zero between them.
 */
function useTextureWorkWhile(isWorking: boolean): void {
  useEffect(() => (isWorking ? textureWork.begin() : undefined), [isWorking]);
}

interface Landed {
  lookup: ProceduralTextureLookup;
  texture: THREE.Texture;
}

/**
 * Holds every key resident while the caller is mounted. Keyed on the joined keys, not the array: an unpin and pin per render would flush the
 * disposals a pinned replace deferred. A key is `identity:typeName` or a content key, whose
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
