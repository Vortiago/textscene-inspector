/**
 * useResource(path, type) — the single surface API for loading any
 * external resource inside an R3F node component. Wraps the event
 * bus internals so callers only see a status machine: pending → loaded
 * | unavailable → loaded (late-arrival).
 *
 * The hook never suspends. Components must branch on `status` directly.
 *
 * Identity semantics (per R3F-contracts.md §1):
 *   - Texture2D, StandardMaterial3D, PackedScene  → identity equality
 *     across calls (same cached reference returned).
 *   - GLBMesh (THREE.Object3D)                    → a fresh clone per
 *     call via cloneWithMaterials(template). THREE.Object3D allows only
 *     one parent, so two consumers must not share the same instance.
 */
import { useContext, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { TscnScene } from '../parser/types';
import type { ResourceEventBus, ResourceType as BusResourceType } from './ResourceEventBus';
import { cloneWithMaterials, disposeClonedMaterials } from './processing/glbProcessing';
import { ResourceLoaderContext } from './ResourceLoaderContext';
import { useMissingResources } from '../r3f/contexts/MissingResourcesContext';

export type ResourceType =
  | 'Texture2D'
  | 'StandardMaterial3D'
  | 'GLBMesh'
  | 'PackedScene'
  | 'Resource'
  | 'ArrayMesh';
/**
 * - `pending`     — still loading.
 * - `loaded`      — value present.
 * - `unavailable` — the value can't be shown: the load failed (resource
 *   not resolvable, or previously failed) OR the hook was used outside a
 *   `<ResourceLoaderProvider>`. Every consumer renders the same placeholder
 *   in this state, so the two causes share one status; the `error` string
 *   carries the human-readable detail (including the programming-error case)
 *   for diagnostics.
 */
export type ResourceStatus = 'pending' | 'loaded' | 'unavailable';

export interface ResourceResult<T> {
  value: T | undefined;
  status: ResourceStatus;
  /**
   * Human-readable error message. Present when status is 'unavailable'.
   * Callers branch on `status`, not on `error` content.
   */
  error?: string;
}

/**
 * Map the public `ResourceType` strings (matching TSCN type names) onto
 * the lowercase namespace strings used by the underlying ResourceEventBus.
 */
const BUS_TYPE: Record<ResourceType, BusResourceType> = {
  Texture2D: 'texture',
  StandardMaterial3D: 'material',
  GLBMesh: 'glb',
  PackedScene: 'scene',
  Resource: 'resource',
  ArrayMesh: 'arraymesh',
};

interface ProcessorAccess<T> {
  /** Read a cached entry: undefined = never requested, null = previously failed, T = loaded. */
  getCached: (path: string) => T | null | undefined;
  /** Trigger a load through the FileEventBus → processor pipeline. */
  request: (path: string) => void;
  /**
   * Increment the pin count — a non-zero pin count protects this entry from
   * LRU eviction for as long as a consumer is mounted against it.
   */
  pin: (path: string) => void;
  /** Decrement the pin count — makes the entry eligible for LRU eviction again. */
  unpin: (path: string) => void;
}

/**
 * Return the processor appropriate for the given resource type. Every
 * resource type is a normal `ResourceProcessor<T>` instance on the
 * loader; PackedScene no longer needs its own adapter.
 */
function getProcessorAccess<T>(
  loader: NonNullable<ReturnType<typeof useResourceLoader>>,
  type: ResourceType
): ProcessorAccess<T> {
  switch (type) {
    case 'Texture2D':
      return loader.textures as unknown as ProcessorAccess<T>;
    case 'StandardMaterial3D':
      return loader.materials as unknown as ProcessorAccess<T>;
    case 'GLBMesh':
      return loader.glbMeshes as unknown as ProcessorAccess<T>;
    case 'PackedScene':
      return loader.scenes as unknown as ProcessorAccess<T>;
    case 'Resource':
      return loader.resources as unknown as ProcessorAccess<T>;
    case 'ArrayMesh':
      return loader.arrayMeshes as unknown as ProcessorAccess<T>;
  }
}

/**
 * Internal: read the loader from context, returning null outside the
 * provider. Exposed so the type-narrowing in `getProcessorAccess` is
 * self-documenting; not part of the public API.
 */
export function useResourceLoader() {
  return useContext(ResourceLoaderContext);
}

/**
 * The hook. See file-level docstring for behavioral contract.
 */
export function useResource<T>(path: string, type: ResourceType): ResourceResult<T> {
  const loader = useResourceLoader();
  const missingResources = useMissingResources();
  const [result, setResult] = useState<ResourceResult<T>>(() => ({
    value: undefined,
    status: 'pending',
  }));

  // Track the *current* (path, type) so a stale event for a previous
  // request can't overwrite state after the consumer changed its
  // arguments. The ref is the source of truth; the deps array on the
  // effect captures the same identity but a closure can outlive a render.
  const currentRef = useRef<{ path: string; type: ResourceType }>({ path, type });
  currentRef.current = { path, type };

  // The ONE clone this hook instance currently holds (GLBMesh only — stays
  // null for every other resource type). Persists across effect re-runs so
  // a path/type swap or unmount can dispose the outgoing clone's materials
  // before the ref is replaced or the hook goes away.
  const clonedRef = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    // Empty path: short-circuit. Callers use the empty string to signal
    // "no request" when they need to keep the hook-call count stable
    // (rules of hooks) but the slot isn't actually populated. Stay in
    // `pending` with no subscription — nothing will ever resolve it,
    // which is what the caller wants.
    if (path === '') {
      setResult({ value: undefined, status: 'pending' });
      return;
    }

    if (!loader) {
      // Used outside a provider — a programming error. It surfaces as
      // `unavailable` (callers render their placeholder) but the error
      // string spells out the cause so it's diagnosable.
      setResult({
        value: undefined,
        status: 'unavailable',
        error:
          'useResource called outside <ResourceLoaderProvider>. ' +
          'Mount a ResourceLoader via <TscnPreviewShell> or wrap the tree manually.',
      });
      return;
    }

    const busType = BUS_TYPE[type];
    const eventBus: ResourceEventBus = loader.eventBus;
    const access = getProcessorAccess<T>(loader, type);

    // Pin the entry so LRU eviction never disposes it while this hook
    // instance is mounted; the cleanup's matching unpin releases it. Safe
    // under StrictMode's mount -> cleanup -> mount: unpin-to-zero does not
    // eagerly dispose, so the remount re-pins the still-cached entry.
    access.pin(path);

    // Fresh subscription per (path, type) pair — keeps cleanup simple
    // and prevents stale handlers from accumulating when the consumer
    // remounts with a different path.
    const isCurrent = () =>
      currentRef.current.path === path && currentRef.current.type === type;

    // Dispose this hook instance's currently-held clone's cloned materials
    // (never its geometry — shared with the template/siblings, see
    // disposeClonedMaterials' docstring). Called before replacing the
    // clone with a fresh one and on unmount/path-swap cleanup.
    const disposePreviousClone = () => {
      if (clonedRef.current) {
        disposeClonedMaterials(clonedRef.current);
        clonedRef.current = null;
      }
    };

    /**
     * For Object3D resources (GLBMesh) clone the cached template so each
     * consumer gets its own attachable instance, tracking the clone so a
     * later replacement/unmount can dispose its materials. Every other
     * resource type passes the raw value through unchanged.
     */
    const toConsumerValue = (rawValue: unknown): unknown => {
      if (type === 'GLBMesh' && rawValue instanceof THREE.Object3D) {
        disposePreviousClone();
        const cloned = cloneWithMaterials(rawValue);
        clonedRef.current = cloned;
        return cloned;
      }
      return rawValue;
    };

    /**
     * Apply a successfully-loaded value to the hook state (via
     * `toConsumerValue`, which owns the per-consumer GLB cloning). The ONE
     * loaded-state writer — both the synchronous cache hit below and the
     * async `loaded` event land here, so the clone/dispose lifecycle can't
     * drift between the two paths.
     */
    const applyValue = (rawValue: unknown) => {
      if (!isCurrent()) return;
      const value = toConsumerValue(rawValue) as T;
      setResult({ value, status: 'loaded' });
    };

    const applyFailure = (errMessage: string) => {
      if (!isCurrent()) return;
      // The processor bus reports every load failure as a single `failed`
      // event with no machine-readable reason, so a failed load is uniformly
      // `unavailable` — the error string carries the human-readable detail.
      setResult({ value: undefined, status: 'unavailable', error: errMessage });
    };

    // 1. Synchronous fast path: if the resource is already cached we can
    //    skip the event subscription entirely. Three possible cache
    //    states from createResourceProcessor:
    //      - undefined: never requested → kick off a request.
    //      - null:      previously failed → report missing.
    //      - <value>:   loaded → report loaded.
    const cached = access.getCached(path);
    if (cached === null) {
      setResult({
        value: undefined,
        status: 'unavailable',
        error: `Resource not available: ${path}`,
      });
      // Still subscribe — the host may later call resourceLoader.provideFile()
      // and we want to react.
    } else if (cached !== undefined) {
      applyValue(cached); // isCurrent() is trivially true this synchronously
      // Still subscribe — the host may invalidate (clearCache) and
      // re-load.
    } else {
      setResult({ value: undefined, status: 'pending' });
    }

    // 2. Subscribe to future loaded/failed events for this path/type.
    const onLoaded = (eventPath: string, data?: unknown) => {
      if (eventPath !== path) return;
      applyValue(data);
    };
    const onFailed = (eventPath: string, error?: Error) => {
      if (eventPath !== path) return;
      applyFailure(error?.message ?? 'Unknown error');
    };

    eventBus.on(busType, 'loaded', onLoaded);
    eventBus.on<Error>(busType, 'failed', onFailed);

    // 3. If we had no cache entry yet, drive the request now. This is
    //    intentionally after subscribing so we don't miss a synchronous
    //    cache-hit emit from `request()`.
    if (cached === undefined) {
      access.request(path);
    }

    return () => {
      access.unpin(path);
      eventBus.off(busType, 'loaded', onLoaded);
      eventBus.off<Error>(busType, 'failed', onFailed);
      disposePreviousClone();
    };
  }, [loader, path, type]);

  // Aggregate missing-path reporting. Runs on every
  // status transition for the current path. The context's default value
  // is a no-op when no provider is mounted, so consumers outside a shell
  // (e.g. linter callers, isolated unit tests) pay no cost.
  //
  // Pull the action callbacks out of the context object — they're
  // useCallback'd inside the provider and so are stable across re-renders.
  // Depending on the whole `missingResources` object would re-run this
  // effect on every state change inside the provider (the missingPaths
  // set itself), creating an infinite render loop.
  const reportMissing = missingResources.report;
  const clearMissing = missingResources.clear;
  const markUploaded = missingResources.markUploaded;

  // Track whether THIS hook instance has ever reported its current path
  // as missing. When status flips missing → loaded the user just
  // uploaded the file, and the panel should keep the row visible (with
  // the uploaded ✓ state) so they know what they fixed. But paths that
  // load on first request (normal fixture resources) never went through
  // `missing`, and should NOT appear as uploaded rows. The ref keeps the
  // distinction per-(path) inside the hook.
  const reportedMissingForPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!path) return;
    if (result.status === 'unavailable') {
      reportMissing(path);
      reportedMissingForPathRef.current = path;
      return () => clearMissing(path);
    }
    if (result.status === 'loaded') {
      if (reportedMissingForPathRef.current === path) {
        // User-uploaded path — leave it visible in the panel as
        // `uploaded ✓` so the Remove affordance stays reachable.
        markUploaded(path);
        reportedMissingForPathRef.current = null;
      } else {
        clearMissing(path);
      }
    }
    return undefined;
  }, [path, result.status, reportMissing, clearMissing, markUploaded]);

  return result;
}

/**
 * Resolve a resource path that may originate from a TSCN `ExtResource("id")`
 * reference. The hook is the most common consumer; this helper is exposed
 * so node components that receive raw TSCN property strings can pass them
 * through without duplicating the parse logic.
 *
 * If `idOrPath` is already a `res://` path, returns it unchanged. If it
 * matches `ExtResource("id")`, looks the id up in the loader's metadata
 * and returns the resolved path. Returns `null` if the id is unknown.
 */
export function resolveResourcePath(
  scene: TscnScene,
  idOrPath: string
): string | null {
  if (idOrPath.startsWith('res://')) {
    return idOrPath;
  }
  const match = idOrPath.match(/^ExtResource\s*\(\s*"([^"]+)"\s*\)$/);
  if (!match || !match[1]) {
    return null;
  }
  const id = match[1];
  const metadata = scene.resourceLoader?.getMetadata(id);
  return metadata?.path ?? null;
}
