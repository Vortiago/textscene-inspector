/** Typed event bus for resource loading events, one slot per resource type. */

import * as THREE from 'three';

export type ResourceEventType =
  | 'requested'
  | 'loading'
  | 'progress'
  | 'loaded'
  | 'failed'
  /**
   * A cached path was dropped by a full cache clear (corpus switch) with no
   * replacement on the way, so mounted consumers re-request. A per-path clear
   * (hot-reload) does not emit this: its caller re-requests itself.
   */
  | 'invalidated';
// One bus-tag union repo-wide: the slice claim table (ADR-0031) is the
// authority, and this alias is what keeps the bus from drifting off it.
// Type-only import, so the claim table's renderer-free closure holds.
import type { ResourceBusType } from './sliceRegistration';
export type ResourceType = ResourceBusType;

export interface ProgressData {
  loaded: number;
  total: number;
}

export type EventHandler<T = unknown> = (id: string, data?: T) => void;

export class ResourceEventBus {
  private handlers = new Map<string, Set<EventHandler<unknown>>>();
  private threeManager: THREE.LoadingManager;

  constructor() {
    this.threeManager = new THREE.LoadingManager();

    this.threeManager.onProgress = (url, loaded, total) => {
      this.emit<ProgressData>('texture', 'progress', url, { loaded, total });
    };
  }

  /**
   * @param resourceType - Type of resource (texture, material, scene)
   * @param eventType - Type of event (requested, loading, loaded, failed)
   * @param handler - Callback function receiving (id, data)
   */
  on<T = unknown>(
    resourceType: ResourceType,
    eventType: ResourceEventType,
    handler: EventHandler<T>
  ): void {
    const key = `${resourceType}:${eventType}`;
    if (!this.handlers.has(key)) {
      this.handlers.set(key, new Set());
    }
    this.handlers.get(key)!.add(handler as EventHandler<unknown>);
  }

  off<T = unknown>(
    resourceType: ResourceType,
    eventType: ResourceEventType,
    handler: EventHandler<T>
  ): void {
    const key = `${resourceType}:${eventType}`;
    this.handlers.get(key)?.delete(handler as EventHandler<unknown>);
  }

  emit<T = unknown>(
    resourceType: ResourceType,
    eventType: ResourceEventType,
    id: string,
    data?: T
  ): void {
    const key = `${resourceType}:${eventType}`;
    const handlers = this.handlers.get(key);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(id, data);
        } catch (error) {
          console.error(`[ResourceEventBus] Handler error for ${key}:`, error);
        }
      }
    }
  }

  /**
   * Resolve when `eventType` fires for `id`. Reject on `failed`, or on `invalidated`:
   * a full cache clear drops the awaited flight with no loaded or failed emit, and the
   * promise would hang.
   */
  once<T = unknown>(
    resourceType: ResourceType,
    eventType: ResourceEventType,
    id: string,
    timeoutMs?: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let resolved = false;

      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        this.off(resourceType, eventType, loadedHandler);
        if (eventType !== 'failed') {
          this.off(resourceType, 'failed', failedHandler);
        }
        if (eventType !== 'invalidated') {
          this.off(resourceType, 'invalidated', invalidatedHandler);
        }
      };

      const loadedHandler: EventHandler<T> = (eventId: string, data?: T) => {
        if (eventId === id) {
          cleanup();
          resolve(data as T);
        }
      };

      const failedHandler: EventHandler<Error> = (eventId: string, error?: Error) => {
        if (eventId === id) {
          cleanup();
          reject(error || new Error(`Resource ${resourceType}:${id} failed to load`));
        }
      };

      const invalidatedHandler: EventHandler = (eventId: string) => {
        if (eventId === id) {
          cleanup();
          reject(new Error(`Resource ${resourceType}:${id} invalidated while awaited`));
        }
      };

      this.on<T>(resourceType, eventType, loadedHandler);

      // Also listen for failed and invalidated, unless that is the awaited event.
      if (eventType !== 'failed') {
        this.on<Error>(resourceType, 'failed', failedHandler);
      }
      if (eventType !== 'invalidated') {
        this.on(resourceType, 'invalidated', invalidatedHandler);
      }

      if (timeoutMs && timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error(`Timeout waiting for ${resourceType}:${eventType}:${id}`));
        }, timeoutMs);
      }
    });
  }

  /**
   * Wait for any of the specified IDs to complete (loaded or failed).
   * Returns when all specified IDs have resolved.
   */
  async waitForAll<T = unknown>(
    resourceType: ResourceType,
    ids: string[],
    timeoutMs?: number
  ): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();

    await Promise.all(
      ids.map(async (id) => {
        try {
          const data = await this.once<T>(resourceType, 'loaded', id, timeoutMs);
          results.set(id, data);
        } catch {
          results.set(id, null);
        }
      })
    );

    return results;
  }

  getThreeManager(): THREE.LoadingManager {
    return this.threeManager;
  }

  /** For memory-leak tests. */
  getHandlerCount(resourceType: ResourceType, eventType: ResourceEventType): number {
    const key = `${resourceType}:${eventType}`;
    return this.handlers.get(key)?.size || 0;
  }

  /** For memory-leak tests. */
  getTotalHandlerCount(): number {
    let total = 0;
    for (const handlers of this.handlers.values()) {
      total += handlers.size;
    }
    return total;
  }

  /** For cleanup and tests. */
  clear(): void {
    this.handlers.clear();
  }
}
