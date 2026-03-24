/**
 * Manages missing resources and recovery workflow.
 */

import type { MissingResource, TscnScene } from '../parser/types';
import type { SceneManager } from './SceneManager';
import * as logger from '../logger';

export class ResourceRecoveryManager {
  private missingResources: Map<string, MissingResource> = new Map();
  private sceneManager: SceneManager;
  private _getCurrentSceneData: () => TscnScene | null;

  constructor(
    sceneManager: SceneManager,
    getCurrentSceneData: () => TscnScene | null
  ) {
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
   * Provide a previously missing resource and trigger automatic recovery.
   *
   * For PackedScene: Uses SceneManager to load the scene.
   * For Texture/Material: Emits resource:provided event which triggers:
   *   1. TextureLoader/MaterialLoader auto-retry failed resources
   *   2. Cascade: texture loads → materials retry → meshes update via events
   *
   * This is more efficient than the old O(n) approach of manually
   * clearing caches and re-rendering all MeshInstance3D nodes.
   */
  async provideResource(path: string): Promise<void> {
    // Get current scene data for event bus access
    const sceneData = this._getCurrentSceneData();
    if (!sceneData || !sceneData.resourceRegistry) {
      logger.warn(`[Resource Provided] No scene data available for: ${path}`);
      return;
    }

    // Get the missing resource (should have been recorded by wrapped onResourceNeeded callback)
    const missingResource = this.missingResources.get(path);
    if (!missingResource) {
      logger.warn(`[Resource Provided] Resource not tracked as missing: ${path}`);
      return;
    }

    logger.info(`[Resource Provided] Processing: ${path} (type: ${missingResource.type})`);

    // Remove from missing list (will be re-added if retry fails via onResourceNeeded callback)
    this.missingResources.delete(path);

    try {
      if (missingResource.type === 'PackedScene') {
        // PackedScene: Still use SceneManager directly (it handles scene hierarchy)
        await this.sceneManager.provideScene(path);
        logger.info(`[Resource Provided] ✅ Successfully loaded PackedScene: ${path}`);
      } else if (missingResource.type.includes('Texture') || missingResource.type.includes('Material')) {
        // Texture/Material: Emit resource:provided event
        // The loaders will automatically retry failed resources via their event subscriptions
        // Cascade: texture:loaded → material retry → material:loaded → mesh updates
        const eventBus = sceneData.resourceRegistry.getEventBus();
        eventBus.emit<string>('resource', 'provided', path, path);

        logger.info(`[Resource Provided] ✅ Emitted resource:provided event for: ${path}`);
      } else {
        logger.warn(`[Resource Provided] Unsupported resource type: ${missingResource.type} for ${path}`);
      }
    } catch (error) {
      logger.error(`[Resource Provided] ❌ Failed to process: ${path}`, error);
      // Re-add to missing resources if it failed
      this.missingResources.set(path, missingResource);
    }
  }
}
