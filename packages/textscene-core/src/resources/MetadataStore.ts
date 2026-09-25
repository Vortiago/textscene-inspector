/** External-resource metadata, looked up by id or by path. */

import type { ExtResource } from '../parser/types';
import * as logger from '../logger';

export class MetadataStore {
  private resources = new Map<string, ExtResource>();

  /**
   * Register a resource for lookup by both id and path. Re-registering an id under a
   * new path (hot-reload rename) evicts the old-path entry, unless another id still
   * owns it.
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

  get(idOrPath: string): ExtResource | undefined {
    return this.resources.get(idOrPath);
  }

  has(idOrPath: string): boolean {
    return this.resources.has(idOrPath);
  }

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

  clear(): void {
    this.resources.clear();
    logger.info('[MetadataStore] Cleared');
  }

  get size(): number {
    return this.getAll().length;
  }
}
