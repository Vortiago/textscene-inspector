/**
 * useResource(path, type) loads an external resource for an R3F node component as a status machine:
 * pending, then loaded or unavailable, and a late arrival turns unavailable loaded. It never
 * suspends. A texture or material keeps its identity across calls, and an Object3D is cloned per
 * consumer, since THREE.Object3D allows one parent.
 */
import { useContext, useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import type { TscnScene } from '../parser/types';
import type { ResourceEventBus } from './ResourceEventBus';
import { cloneWithMaterials, disposeClonedMaterials } from './processing/glbProcessing';
import { ResourceLoaderContext } from './ResourceLoaderContext';
import { useMissingResources } from '../r3f/contexts/MissingResourcesContext';
import { resourceRef } from '../godot/index.js';
import { resourceSliceRegistry, type ResourceBusType } from './sliceRegistration';

/**
 * `unavailable` covers a failed load and a hook used outside a `<ResourceLoaderProvider>`. Every
 * consumer renders the same placeholder for both, so they share one status, and `error` tells
 * them apart.
 */
export type ResourceStatus = 'pending' | 'loaded' | 'unavailable';

export interface ResourceResult<T> {
  value: T | undefined;
  status: ResourceStatus;
  /** Present when status is 'unavailable'. Callers branch on `status`, not on this text. */
  error?: string;
}

/** The loader from context, or null outside the provider. */
export function useResourceLoader() {
  return useContext(ResourceLoaderContext);
}

export function useResource<T>(path: string, type: ResourceBusType): ResourceResult<T> {
  const loader = useResourceLoader();
  const missingResources = useMissingResources();
  const [result, setResult] = useState<ResourceResult<T>>(() => ({
    value: undefined,
    status: 'pending',
  }));

  // A ref, not the effect's closure: a closure outlives its render, so a stale event for an
  // earlier (path, type) would overwrite the state.
  const currentRef = useRef<{ path: string; type: ResourceBusType }>({ path, type });
  currentRef.current = { path, type };

  // The clone this hook holds, for a cloned-per-consumer bus only. It outlives an effect run, so a
  // path swap or an unmount can dispose the outgoing clone's materials.
  const clonedRef = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    // An empty path means no request: a caller keeps its hook count stable for an empty slot.
    // It stays `pending` with no subscription.
    if (path === '') {
      setResult({ value: undefined, status: 'pending' });
      return;
    }

    if (!loader) {
      setResult({
        value: undefined,
        status: 'unavailable',
        error:
          'useResource called outside <ResourceLoaderProvider>. ' +
          'Mount a ResourceLoader via <TscnPreviewShell> or wrap the tree manually.',
      });
      return;
    }

    const busType = type;
    const eventBus: ResourceEventBus = loader.eventBus;
    const clonePerConsumer = resourceSliceRegistry.clonesPerConsumer(type);
    const access = loader.processor<T>(type);
    if (!access) {
      setResult({ value: undefined, status: 'unavailable', error: `No processor serves resource bus '${type}'.` });
      return;
    }

    // The pin keeps LRU eviction off the entry while mounted. StrictMode's mount, cleanup, mount is
    // safe: an unpin to zero does not dispose, so the remount re-pins the cached entry.
    access.pin(path);

    const isCurrent = () =>
      currentRef.current.path === path && currentRef.current.type === type;

    // Materials only: the geometry is shared with the template and the sibling clones.
    const disposePreviousClone = () => {
      if (clonedRef.current) {
        disposeClonedMaterials(clonedRef.current);
        clonedRef.current = null;
      }
    };

    const toConsumerValue = (rawValue: unknown): unknown => {
      // The flag, not `instanceof`: a second three.js copy fails `instanceof` across realms.
      if (clonePerConsumer && (rawValue as { isObject3D?: boolean })?.isObject3D === true) {
        disposePreviousClone();
        const cloned = cloneWithMaterials(rawValue as THREE.Object3D);
        clonedRef.current = cloned;
        return cloned;
      }
      return rawValue;
    };

    /** The one writer of the loaded state, so a cache hit and a `loaded` event clone alike. */
    const applyValue = (rawValue: unknown) => {
      if (!isCurrent()) return;
      const value = toConsumerValue(rawValue) as T;
      setResult({ value, status: 'loaded' });
    };

    const applyFailure = (errMessage: string) => {
      if (!isCurrent()) return;
      // The bus reports every failure as one `failed` event with no reason code.
      setResult({ value: undefined, status: 'unavailable', error: errMessage });
    };

    // The cache holds undefined for never requested, null for failed, and the value once loaded.
    const cached = access.getCached(path);
    if (cached === null) {
      setResult({
        value: undefined,
        status: 'unavailable',
        error: `Resource not available: ${path}`,
      });
      // It still subscribes: the host may provide the file later.
    } else if (cached !== undefined) {
      applyValue(cached);
      // It still subscribes: the host may clear the cache and reload.
    } else {
      setResult({ value: undefined, status: 'pending' });
    }

    const onLoaded = (eventPath: string, data?: unknown) => {
      if (eventPath !== path) return;
      applyValue(data);
    };
    const onFailed = (eventPath: string, error?: Error) => {
      if (eventPath !== path) return;
      applyFailure(error?.message ?? 'Unknown error');
    };
    // A full cache clear (a corpus switch) dropped this path, so it is requested again and the old
    // value stays on screen meanwhile. A path absent from the new corpus fails to unavailable: one
    // burst of doomed refetches per switch, bounded by the mounted working set.
    const onInvalidated = (eventPath: string) => {
      if (eventPath !== path) return;
      if (!isCurrent()) return;
      access.request(path);
    };

    eventBus.on(busType, 'loaded', onLoaded);
    eventBus.on<Error>(busType, 'failed', onFailed);
    eventBus.on(busType, 'invalidated', onInvalidated);

    // After subscribing, so a synchronous emit from `request()` is not missed.
    if (cached === undefined) {
      access.request(path);
    }

    return () => {
      access.unpin(path);
      eventBus.off(busType, 'loaded', onLoaded);
      eventBus.off<Error>(busType, 'failed', onFailed);
      eventBus.off(busType, 'invalidated', onInvalidated);
      disposePreviousClone();
    };
  }, [loader, path, type]);

  // The callbacks, not the context object: the object changes with every missing-path update, so
  // depending on it loops the render. Outside a provider the context is a no-op.
  const reportMissing = missingResources.report;
  const clearMissing = missingResources.clear;
  const markUploaded = missingResources.markUploaded;

  // A path that loads after this hook reported it missing was uploaded, so its row stays, marked
  // uploaded. A path that loads on first request never shows a row.
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
        // The row stays, so its Remove control stays reachable.
        markUploaded(path);
        reportedMissingForPathRef.current = null;
      } else {
        clearMissing(path);
      }
    }
    return undefined;
  }, [path, result.status, reportMissing, clearMissing, markUploaded]);

  // The loader counts pending consumers, so a caller knows when loading has finished without a
  // timer. Keyed on `path` too: a path swap re-enters `pending`.
  useEffect(() => {
    if (!loader || !path || result.status !== 'pending') return undefined;
    return loader.beginPending();
  }, [loader, path, result.status]);

  return result;
}

/**
 * The `res://` path for a raw property string: a `res://` path unchanged, or the path of an
 * `ExtResource("id")`. Null for an unknown id or any other form.
 */
export function resolveResourcePath(
  scene: TscnScene,
  idOrPath: string
): string | null {
  if (idOrPath.startsWith('res://')) {
    return idOrPath;
  }
  const parsed = resourceRef(idOrPath);
  if (parsed?.kind !== 'ExtResource') {
    return null;
  }
  const metadata = scene.resourceLoader?.getMetadata(parsed.id);
  return metadata?.path ?? null;
}
