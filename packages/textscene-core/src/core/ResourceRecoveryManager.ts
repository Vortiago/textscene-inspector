/**
 * Manages missing resources and recovery workflow.
 */

import type { MissingResource, TscnScene } from '../parser/types';
import { NodeTracker } from './NodeTracker';
import type { SceneManager } from './SceneManager';
import * as logger from '../logger';

export class ResourceRecoveryManager {
  private missingResources: Map<string, MissingResource> = new Map();
  private _nodeTracker: NodeTracker;
  private sceneManager: SceneManager;
  private _getCurrentSceneData: () => TscnScene | null;

  constructor(
    nodeTracker: NodeTracker,
    sceneManager: SceneManager,
    getCurrentSceneData: () => TscnScene | null
  ) {
    this._nodeTracker = nodeTracker;
    this.sceneManager = sceneManager;
    this._getCurrentSceneData = getCurrentSceneData;
  }

  /**
   * Record a missing resource
   */
  recordMissing(resource: MissingResource): void {
    this.missingResources.set(resource.path, resource);
  }

  /**
   * Get list of all missing resources
   */
  getMissingResources(): MissingResource[] {
    return Array.from(this.missingResources.values());
  }

  /**
   * Clear all missing resources
   */
  clear(): void {
    this.missingResources.clear();
  }

  /**
   * Provide a previously missing resource and re-render affected nodes.
   */
  async provideResource(path: string): Promise<void> {
    const missingResource = this.missingResources.get(path);
    if (!missingResource) {
      logger.warn(`provideResource called for non-missing resource: ${path}`);
      return;
    }

    logger.info(`[Resource Provided] Re-attempting load of: ${path}`);

    // Remove from missing list (will be re-added if it fails again)
    this.missingResources.delete(path);

    // Re-attempt to load the external scene using SceneManager
    try {
      await this.sceneManager.updateScene(path);
      logger.info(`[Resource Provided] ✅ Successfully loaded: ${path}`);
    } catch (error) {
      logger.error(`[Resource Provided] ❌ Failed to load: ${path}`, error);
      // Re-add to missing resources if it failed again
      this.missingResources.set(path, missingResource);
    }
  }
}
