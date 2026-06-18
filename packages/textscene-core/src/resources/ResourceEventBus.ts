/**
 * Custom event bus for resource loading events.
 * Provides type-safe event emission and subscription for textures, materials, and scenes.
 */

import * as THREE from 'three';

export type ResourceEventType = 'requested' | 'loading' | 'progress' | 'loaded' | 'failed';
export type ResourceType = 'texture' | 'material' | 'scene' | 'glb' | 'resource' | 'arraymesh';

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

    // Integrate with THREE.LoadingManager for automatic progress tracking
    this.threeManager.onProgress = (url, loaded, total) => {
      this.emit<ProgressData>('texture', 'progress', url, { loaded, total });
    };
  }

  /**
   * Subscribe to resource events.
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

  /**
   * Unsubscribe from resource events.
   */
  off<T = unknown>(
    resourceType: ResourceType,
    eventType: ResourceEventType,
    handler: EventHandler<T>
  ): void {
    const key = `${resourceType}:${eventType}`;
    this.handlers.get(key)?.delete(handler as EventHandler<unknown>);
  }

  /**
   * Emit resource event to all subscribers.
   */
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
   * Promise wrapper for one-time event subscription.
   * Resolves when the specified event fires for the given resource ID.
   * Rejects if the 'failed' event fires instead.
   *
   * Used for backward-compatible promise API.
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

      this.on<T>(resourceType, eventType, loadedHandler);

      // Also listen for failed events unless we're specifically waiting for failure
      if (eventType !== 'failed') {
        this.on<Error>(resourceType, 'failed', failedHandler);
      }

      // Optional timeout
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

  /**
   * Get THREE.js LoadingManager for integration with THREE loaders.
   */
  getThreeManager(): THREE.LoadingManager {
    return this.threeManager;
  }

  /**
   * Get handler count for memory leak testing.
   */
  getHandlerCount(resourceType: ResourceType, eventType: ResourceEventType): number {
    const key = `${resourceType}:${eventType}`;
    return this.handlers.get(key)?.size || 0;
  }

  /**
   * Get total handler count across all event types.
   */
  getTotalHandlerCount(): number {
    let total = 0;
    for (const handlers of this.handlers.values()) {
      total += handlers.size;
    }
    return total;
  }

  /**
   * Clear all handlers (for cleanup/testing).
   */
  clear(): void {
    this.handlers.clear();
  }
}
