/**
 * Manages external scene loading, instancing, and hot-reload.
 * Tracks which scene instances use which external scenes.
 */

import * as THREE from 'three';
import type { TscnScene } from '../parser/types';
import type { TscnParser } from '../parser/TscnParser';
import type { ResourceRegistry } from '../resources/ResourceRegistry';
import type { NodeLifecycleManager } from './NodeLifecycleManager';
import type { NodeTracker } from './NodeTracker';
import { joinPath } from '../utils/nodePath';
import * as logger from '../logger';

export class SceneManager {
  private parser: TscnParser;
  private resourceRegistry: ResourceRegistry | null = null;
  private nodeLifecycle: NodeLifecycleManager | null = null;
  private nodeTracker: NodeTracker;

  // Track which instances come from which scene files
  // Map<scenePath, Set<instanceNodePath>>
  private sceneInstances: Map<string, Set<string>> = new Map();

  // Cache parsed scenes (path → TscnScene)
  private sceneCache: Map<string, TscnScene> = new Map();

  constructor(parser: TscnParser, nodeTracker: NodeTracker) {
    this.parser = parser;
    this.nodeTracker = nodeTracker;
  }

  /**
   * Set the resource registry (called when scene is loaded)
   */
  setResourceRegistry(registry: ResourceRegistry): void {
    this.resourceRegistry = registry;
  }

  /**
   * Set the node lifecycle manager (called after construction to break circular dependency)
   */
  setNodeLifecycleManager(nodeLifecycle: NodeLifecycleManager): void {
    this.nodeLifecycle = nodeLifecycle;
  }

  /**
   * Load and cache a scene from external file
   */
  async loadScene(scenePath: string): Promise<TscnScene> {
    // Check cache first
    if (this.sceneCache.has(scenePath)) {
      logger.info(`[SceneManager] Using cached scene: ${scenePath}`);
      return this.sceneCache.get(scenePath)!;
    }

    if (!this.resourceRegistry) {
      throw new Error('ResourceRegistry not set. Call setResourceRegistry() before loading scenes.');
    }

    // Load raw content via ResourceRegistry (handles circular deps)
    logger.info(`[SceneManager] Loading scene from registry: ${scenePath}`);
    const content = await this.resourceRegistry.loadByPath(scenePath);

    if (typeof content !== 'string') {
      throw new Error(`Scene must be text content: ${scenePath}`);
    }

    // Parse and cache
    logger.info(`[SceneManager] Parsing scene: ${scenePath}`);
    const scene = this.parser.parse(content);
    this.sceneCache.set(scenePath, scene);
    logger.info(`[SceneManager] Cached parsed scene: ${scenePath} with ${scene.nodes.length} root nodes`);

    return scene;
  }

  /**
   * Recursively set userData.instanceRoot on an object and all its descendants
   */
  private setInstanceRootOnDescendants(object: THREE.Object3D, instancePath: string): void {
    object.userData.instanceRoot = instancePath;
    for (const child of object.children) {
      this.setInstanceRootOnDescendants(child, instancePath);
    }
  }

  /**
   * Add external scene nodes as children of an instance node
   * Sets instanceRoot on all added nodes and their descendants
   */
  private async addExternalSceneNodes(
    externalScene: TscnScene,
    instancePath: string
  ): Promise<void> {
    for (const externalNode of externalScene.nodes) {
      const childPath = joinPath(instancePath, externalNode.name);
      logger.info(`[SceneManager] Adding external node: ${externalNode.name} at path: ${childPath}`);
      await this.nodeLifecycle!.addNode(childPath, externalNode, externalScene, instancePath);

      // Set instanceRoot flag on the created object and all its descendants
      const childObject = this.nodeTracker.getObject(childPath);
      if (childObject) {
        this.setInstanceRootOnDescendants(childObject, instancePath);
        logger.info(`[SceneManager] Set instanceRoot=${instancePath} on ${childPath} and descendants`);
      }
    }
  }

  /**
   * Add scene instance to the graph
   * Registers this instance path as using the scene
   */
  async addScene(instancePath: string, scenePath: string): Promise<void> {
    if (!this.nodeLifecycle) {
      throw new Error('NodeLifecycleManager not set. Call setNodeLifecycleManager() first.');
    }

    logger.info(`[SceneManager] Adding scene instance: ${instancePath} from ${scenePath}`);

    // Load the external scene
    const externalScene = await this.loadScene(scenePath);

    // Track this instance
    if (!this.sceneInstances.has(scenePath)) {
      this.sceneInstances.set(scenePath, new Set());
    }
    this.sceneInstances.get(scenePath)!.add(instancePath);
    logger.info(
      `[SceneManager] Tracking instance: ${instancePath} (total instances of ${scenePath}: ${this.sceneInstances.get(scenePath)!.size})`
    );

    // Add all root nodes from external scene as children of instance node
    await this.addExternalSceneNodes(externalScene, instancePath);

    logger.info(`[SceneManager] ✅ Successfully added scene instance: ${instancePath}`);
  }

  /**
   * Remove scene instance
   */
  removeScene(instancePath: string): void {
    if (!this.nodeLifecycle) {
      throw new Error('NodeLifecycleManager not set. Call setNodeLifecycleManager() first.');
    }

    logger.info(`[SceneManager] Removing scene instance: ${instancePath}`);

    // Find which scene this instance came from
    for (const [scenePath, instances] of this.sceneInstances.entries()) {
      if (instances.has(instancePath)) {
        instances.delete(instancePath);
        logger.info(`[SceneManager] Removed from tracking: ${instancePath} (${instances.size} instances remain)`);

        // Remove from graph
        this.nodeLifecycle.removeNode(instancePath);

        // If no more instances, remove from tracking
        if (instances.size === 0) {
          this.sceneInstances.delete(scenePath);
          logger.info(`[SceneManager] No more instances of ${scenePath}, removed from tracking`);
        }

        return;
      }
    }

    logger.warn(`[SceneManager] Instance not found in tracking: ${instancePath}`);
  }

  /**
   * Update scene - hot-reload all instances using this scene
   * THIS IS THE KEY METHOD for hot-reload!
   */
  async updateScene(scenePath: string): Promise<void> {
    if (!this.nodeLifecycle) {
      throw new Error('NodeLifecycleManager not set. Call setNodeLifecycleManager() first.');
    }

    if (!this.resourceRegistry) {
      throw new Error('ResourceRegistry not set. Call setResourceRegistry() first.');
    }

    // Find all instances using this scene first
    const instances = this.sceneInstances.get(scenePath);
    if (!instances || instances.size === 0) {
      logger.info(`[SceneManager] No instances found for ${scenePath}, nothing to update`);
      return;
    }

    logger.info(`[SceneManager] 🔄 Hot-reloading scene: ${scenePath}`);

    // Clear cache to force reload
    this.sceneCache.delete(scenePath);
    this.resourceRegistry.clearCache(scenePath);
    logger.info(`[SceneManager] Cleared caches for: ${scenePath}`);

    // Reload the scene
    const updatedScene = await this.loadScene(scenePath);

    logger.info(`[SceneManager] Updating ${instances.size} instances of ${scenePath}`);

    // Update each instance
    let successCount = 0;
    for (const instancePath of instances) {
      try {
        // Get the instance node data
        const instanceNode = this.nodeTracker.getNode(instancePath);
        const instanceObject = this.nodeTracker.getObject(instancePath);

        if (!instanceNode || !instanceObject) {
          logger.warn(`[SceneManager] Instance not found in tracker: ${instancePath}`);
          continue;
        }

        logger.info(`[SceneManager] Updating instance: ${instancePath}`);

        // Remove old instance content (but keep the instance node itself)
        // We need to remove children, not the instance node
        // TODO: O(n) optimization - NodeTracker could maintain parent→children map for O(k) lookup
        const childrenToRemove: string[] = [];
        for (const path of this.nodeTracker.getAllPaths()) {
          if (path.startsWith(instancePath + '/')) {
            childrenToRemove.push(path);
          }
        }

        for (const childPath of childrenToRemove) {
          this.nodeLifecycle.removeNode(childPath);
        }

        // Re-add external scene nodes as children
        await this.addExternalSceneNodes(updatedScene, instancePath);

        successCount++;
        logger.info(`[SceneManager] ✓ Updated instance: ${instancePath}`);
      } catch (error) {
        logger.error(`[SceneManager] ✗ Failed to update instance ${instancePath}:`, error);
      }
    }

    logger.info(`[SceneManager] ✅ Hot-reload complete for ${scenePath}: ${successCount}/${instances.size} instances updated`);
  }

  /**
   * Get all instance paths for a scene
   */
  getInstances(scenePath: string): string[] {
    return Array.from(this.sceneInstances.get(scenePath) || []);
  }

  /**
   * Check if a scene has any instances
   */
  hasInstances(scenePath: string): boolean {
    const instances = this.sceneInstances.get(scenePath);
    return instances !== undefined && instances.size > 0;
  }

  /**
   * Get total count of all instances across all scenes
   */
  getTotalInstanceCount(): number {
    let count = 0;
    for (const instances of this.sceneInstances.values()) {
      count += instances.size;
    }
    return count;
  }

  /**
   * Get all tracked scene paths
   */
  getTrackedScenes(): string[] {
    return Array.from(this.sceneInstances.keys());
  }

  /**
   * Clear all caches and tracking
   */
  clear(): void {
    this.sceneCache.clear();
    this.sceneInstances.clear();
    logger.info('[SceneManager] Cleared all caches and tracking');
  }
}
