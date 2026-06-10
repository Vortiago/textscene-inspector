/**
 * Simple storage for resource metadata.
 * Replaces the metadata management from the old ResourceRegistry class.
 */

import type { ExtResource } from '../parser/types';
import * as logger from '../logger';

/**
 * Stores resource metadata for lookup by ID or path.
 */
export class MetadataStore {
  private resources = new Map<string, ExtResource>();

  /**
   * Register a resource for lookup by both ID and path.
   *
   * Re-registering a known id under a new path (hot-reload rename) evicts
   * the stale old-path entry so lookups by the old path miss. The eviction
   * is skipped when another id still owns the old path entry (aliases).
   */
  register(resource: ExtResource): void {
    if (resource.id) {
      const previous = this.resources.get(resource.id);
      if (previous && previous.path !== resource.path) {
        const oldPathEntry = this.resources.get(previous.path);
        if (oldPathEntry && oldPathEntry.id === resource.id) {
          this.resources.delete(previous.path);
          logger.info(`[MetadataStore] Evicted stale path entry: ${previous.path} (id "${resource.id}" moved to ${resource.path})`);
        }
      }
      this.resources.set(resource.id, resource);
    }
    this.resources.set(resource.path, resource);
    logger.info(`[MetadataStore] Registered: ${resource.type} id="${resource.id}" at ${resource.path}`);
  }

  /**
   * Get resource metadata by ID or path.
   */
  get(idOrPath: string): ExtResource | undefined {
    return this.resources.get(idOrPath);
  }

  /**
   * Get the path for a resource ID.
   */
  getPath(idOrPath: string): string | undefined {
    return this.resources.get(idOrPath)?.path;
  }

  /**
   * Get the type for a resource.
   */
  getType(idOrPath: string): string | undefined {
    return this.resources.get(idOrPath)?.type;
  }

  /**
   * Check if a resource exists.
   */
  has(idOrPath: string): boolean {
    return this.resources.has(idOrPath);
  }

  /**
   * Get all unique resources.
   */
  getAll(): ExtResource[] {
    const seen = new Set<string>();
    const unique: ExtResource[] = [];

    for (const resource of this.resources.values()) {
      if (!seen.has(resource.path)) {
        seen.add(resource.path);
        unique.push(resource);
      }
    }

    return unique;
  }

  /**
   * Clear all stored metadata.
   */
  clear(): void {
    this.resources.clear();
    logger.info('[MetadataStore] Cleared');
  }

  /**
   * Get the number of unique resources.
   */
  get size(): number {
    return this.getAll().length;
  }
}
