/**
 * useResource(path, type) — the single surface API for loading any
 * external resource inside an R3F node component. Wraps the WI-79 event
 * bus internals so callers only see a status machine: pending → loaded
 * | missing → loaded (late-arrival) | error.
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
import { cloneWithMaterials } from './processing/glbProcessing';
import { ResourceLoaderContext } from './ResourceLoaderContext';
import { useMissingResources } from '../r3f/contexts/MissingResourcesContext';

export type ResourceType = 'Texture2D' | 'StandardMaterial3D' | 'GLBMesh' | 'PackedScene';
export type ResourceStatus = 'pending' | 'loaded' | 'missing' | 'error';

export interface ResourceResult<T> {
  value: T | undefined;
  status: ResourceStatus;
  /**
   * Human-readable error message. Present when status is 'missing' or
   * 'error'. Callers branch on `status`, not on `error` content.
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
};

interface ProcessorAccess<T> {
  /** Read a cached entry: undefined = never requested, null = previously failed, T = loaded. */
  getCached: (path: string) => T | null | undefined;
  /** Trigger a load through the FileEventBus → processor pipeline. */
  request: (path: string) => void;
}

/**
 * Return the processor appropriate for the given resource type. Post
 * WI-ARCH-2 all four resource types are normal `ResourceProcessor<T>`
 * instances on the loader; PackedScene no longer needs its own adapter.
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
      setResult({
        value: undefined,
        status: 'error',
        error:
          'useResource called outside <ResourceLoaderProvider>. ' +
          'Mount a ResourceLoader via <TscnPreviewShell> or wrap the tree manually.',
      });
      return;
    }

    const busType = BUS_TYPE[type];
    const eventBus: ResourceEventBus = loader.eventBus;
    const access = getProcessorAccess<T>(loader, type);

    // Fresh subscription per (path, type) pair — keeps cleanup simple
    // and prevents stale handlers from accumulating when the consumer
    // remounts with a different path.
    const isCurrent = () =>
      currentRef.current.path === path && currentRef.current.type === type;

    /**
     * Apply a successfully-loaded value to the hook state. For Object3D
     * resources (GLBMesh) this clones the cached template so each
     * consumer gets its own attachable instance.
     */
    const applyValue = (rawValue: unknown) => {
      if (!isCurrent()) return;
      let value = rawValue as T;
      if (type === 'GLBMesh' && rawValue instanceof THREE.Object3D) {
        value = cloneWithMaterials(rawValue) as unknown as T;
      }
      setResult({ value, status: 'loaded' });
    };

    const applyFailure = (errMessage: string) => {
      if (!isCurrent()) return;
      // 'missing' covers "host couldn't resolve the path". The contract
      // distinguishes this from 'error' (host resolved but parsing
      // failed). The processor surface today reports both as `failed`
      // events; we infer missing-vs-error from the error message until
      // the bus carries a richer reason. Practically all current
      // failures are missing-file, so default to 'missing'.
      const status: ResourceStatus = /parse|decode|invalid|corrupt|malformed/i.test(
        errMessage
      )
        ? 'error'
        : 'missing';
      setResult({ value: undefined, status, error: errMessage });
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
        status: 'missing',
        error: `Resource not available: ${path}`,
      });
      // Still subscribe — the host may later call resourceLoader.provideFile()
      // and we want to react.
    } else if (cached !== undefined) {
      let value = cached as T;
      if (type === 'GLBMesh' && cached instanceof THREE.Object3D) {
        value = cloneWithMaterials(cached) as unknown as T;
      }
      setResult({ value, status: 'loaded' });
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
      eventBus.off(busType, 'loaded', onLoaded);
      eventBus.off<Error>(busType, 'failed', onFailed);
    };
  }, [loader, path, type]);

  // Aggregate missing-path reporting (WI-UX-3 / WI-UX-6). Runs on every
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
  // as missing. WI-UX-6: when status flips missing → loaded the user just
  // uploaded the file, and the panel should keep the row visible (with
  // the uploaded ✓ state) so they know what they fixed. But paths that
  // load on first request (normal fixture resources) never went through
  // `missing`, and should NOT appear as uploaded rows. The ref keeps the
  // distinction per-(path) inside the hook.
  const reportedMissingForPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!path) return;
    if (result.status === 'missing') {
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
