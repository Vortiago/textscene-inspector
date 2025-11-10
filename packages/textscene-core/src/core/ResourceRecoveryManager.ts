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
    // Get current scene data for re-rendering nodes
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

    logger.info(`[Resource Provided] Re-attempting load of: ${path} (type: ${missingResource.type})`);

    // Remove from missing list (will be re-added if it fails again)
    this.missingResources.delete(path);

    try {
      // Handle different resource types
      if (missingResource.type === 'PackedScene') {
        // Provide the external scene using SceneManager (non-destructive)
        await this.sceneManager.provideScene(path);
        logger.info(`[Resource Provided] ✅ Successfully loaded PackedScene: ${path}`);
      } else if (missingResource.type.includes('Texture')) {
        // Texture2D: Clear texture cache, clear all material caches, re-render meshes
        logger.info(`[Resource Provided] Clearing caches for Texture: ${path}`);

        sceneData.resourceRegistry.clearTextureCache(path);
        sceneData.resourceRegistry.clearMaterialCache(); // Clear ALL materials

        // Find all MeshInstance3D nodes and re-render them
        // IMPORTANT: Convert Set to Array to avoid modifying collection while iterating
        const meshPaths = Array.from(this._nodeTracker.getNodesByType('MeshInstance3D'));
        logger.info(`[Resource Provided] Re-rendering ${meshPaths.length} MeshInstance3D nodes`);

        for (const meshPath of meshPaths) {
          const node = this._nodeTracker.getNode(meshPath);
          if (node) {
            await this.sceneManager.getNodeLifecycle().updateNode(meshPath, node, sceneData);
          }
        }

        logger.info(`[Resource Provided] ✅ Successfully provided Texture and updated meshes: ${path}`);
      } else if (missingResource.type.includes('Material')) {
        // Material: Clear material cache, re-render meshes
        // NOTE: Clear ALL materials since they're cached by ID, not path
        logger.info(`[Resource Provided] Clearing all material caches for: ${path}`);

        sceneData.resourceRegistry.clearMaterialCache(); // Clear ALL materials

        // Find all MeshInstance3D nodes and re-render them
        // IMPORTANT: Convert Set to Array to avoid modifying collection while iterating
        const meshPaths = Array.from(this._nodeTracker.getNodesByType('MeshInstance3D'));
        logger.info(`[Resource Provided] Re-rendering ${meshPaths.length} MeshInstance3D nodes`);

        for (const meshPath of meshPaths) {
          const node = this._nodeTracker.getNode(meshPath);
          if (node) {
            await this.sceneManager.getNodeLifecycle().updateNode(meshPath, node, sceneData);
          }
        }

        logger.info(`[Resource Provided] ✅ Successfully provided Material and updated meshes: ${path}`);
      } else {
        logger.warn(`[Resource Provided] Unsupported resource type: ${missingResource.type} for ${path}`);
      }
    } catch (error) {
      logger.error(`[Resource Provided] ❌ Failed to load: ${path}`, error);
      // Re-add to missing resources if it failed again
      this.missingResources.set(path, missingResource);
    }
  }
}
