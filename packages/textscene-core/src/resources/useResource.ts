/**
 * useResource(path, type) loads an external resource for an R3F node component as a status
 * machine: pending, then loaded or unavailable, and a late arrival turns unavailable loaded. It
 * never suspends, and a failed path shows as a **Missing resource** row. A texture or material keeps its identity across calls, and an Object3D is
 * cloned per consumer, since THREE.Object3D allows one parent.
 */
import { useContext, useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import type { ResourceEventBus } from './ResourceEventBus';
import { cloneWithMaterials, disposeClonedMaterials } from './processing/glbProcessing';
import { ResourceLoaderContext } from './ResourceLoaderContext';
import { useMissingReport } from '../r3f/contexts/MissingResourcesContext';
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

const PENDING: ResourceResult<never> = { value: undefined, status: 'pending' };

/** The loader from context, or null outside the provider. */
export function useResourceLoader() {
  return useContext(ResourceLoaderContext);
}

export function useResource<T>(path: string, type: ResourceBusType): ResourceResult<T> {
  const result = useResourceLoad<T>(path, type);
  useMissingReport(path, result.status);
  return result;
}

/**
 * `useResource` without the **Missing resource** report, for a caller that reads a
 * **Sub-resource path** out of a whole file and reports the address itself.
 */
export function useResourceLoad<T>(path: string, type: ResourceBusType): ResourceResult<T> {
  const loader = useResourceLoader();
  // The request a result belongs to: the render that swaps the path or the bus still holds the
  // old request's result, whose value may be a disposed clone, so that render answers pending.
  const [settled, setSettled] = useState<{ path: string; type: ResourceBusType; result: ResourceResult<T> }>(
    () => ({ path, type, result: PENDING })
  );
  const result = settled.path === path && settled.type === type ? settled.result : PENDING;

  // A ref, not the effect's closure: a closure outlives its render, so a stale event for an
  // earlier (path, type) would overwrite the state.
  const currentRef = useRef<{ path: string; type: ResourceBusType }>({ path, type });
  currentRef.current = { path, type };

  // The clone this hook holds, for a cloned-per-consumer bus only. It outlives an effect run, so a
  // path swap or an unmount can dispose the outgoing clone's materials.
  const clonedRef = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    const setResult = (next: ResourceResult<T>) => setSettled({ path, type, result: next });

    // An empty path means no request: a caller keeps its hook count stable for an empty slot.
    // It stays `pending` with no subscription. Keeping an empty-path state avoids a second render
    // of every caller on mount, and replacing an older one drops a result whose clone is disposed.
    if (path === '') {
      setSettled((prev) => (prev.path === '' && prev.type === type ? prev : { path, type, result: PENDING }));
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
      setResult({
        value: undefined,
        status: 'unavailable',
        error: `No processor serves resource bus '${type}'.`,
      });
      return;
    }

    // The pin keeps LRU eviction off the entry while mounted. StrictMode's mount, cleanup, mount is
    // safe: an unpin to zero does not dispose, so the remount re-pins the cached entry.
    access.pin(path);

    const isCurrent = () => currentRef.current.path === path && currentRef.current.type === type;

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
    // A clear dropped this path (a corpus switch, or a **Dependency hot-reload** of its file), so
    // it is requested again and the old value stays on screen meanwhile. A path that is gone now
    // fails to unavailable: one burst of doomed refetches, bounded by the mounted working set.
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

  // The loader counts pending consumers, so a caller knows when loading has finished without a
  // timer. Keyed on `path` too: a path swap re-enters `pending`.
  useEffect(() => {
    if (!loader || !path || result.status !== 'pending') return undefined;
    return loader.beginPending();
  }, [loader, path, result.status]);

  return result;
}
