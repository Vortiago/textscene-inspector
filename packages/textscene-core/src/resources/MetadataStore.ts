/** External-resource metadata, looked up by id or by path. */

import type { ExtResource } from '../parser/types';
import * as logger from '../logger';
import { simplifyResPath } from '../godot/index.js';

export class MetadataStore {
  private resources = new Map<string, ExtResource>();

  /**
   * Register a resource for lookup by both id and path. Re-registering an id under a
   * new path (hot-reload rename) evicts the old-path entry, unless another id still
   * owns it.
   */
  register(registered: ExtResource): void {
    const resource = withSimplifiedPath(registered);
    if (resource.id) {
      const previous = this.resources.get(resource.id);
      if (previous && previous.path !== resource.path) {
        const oldPathEntry = this.resources.get(previous.path);
        if (oldPathEntry && oldPathEntry.id === resource.id) {
          this.resources.delete(previous.path);
          logger.info(
            `[MetadataStore] Evicted stale path entry: ${previous.path} (id "${resource.id}" moved to ${resource.path})`
          );
        }
      }
      this.resources.set(resource.id, resource);
    }
    this.resources.set(resource.path, resource);
    logger.info(`[MetadataStore] Registered: ${resource.type} id="${resource.id}" at ${resource.path}`);
  }

  /** An id never holds `://`, so simplifying the key leaves an id alone. */
  get(idOrPath: string): ExtResource | undefined {
    return this.resources.get(simplifyResPath(idOrPath));
  }

  has(idOrPath: string): boolean {
    return this.get(idOrPath) !== undefined;
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

/**
 * Keyed by the simplified path, the address every load requests: Godot runs each
 * resource address through `String::simplify_path`, and a scene may write `res:///…`.
 */
function withSimplifiedPath(resource: ExtResource): ExtResource {
  const path = simplifyResPath(resource.path);
  return path === resource.path ? resource : { ...resource, path };
}
