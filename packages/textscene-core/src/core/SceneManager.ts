/**
 * Manages external scene loading, instancing, and hot-reload.
 * Tracks which scene instances use which external scenes.
 */

import * as THREE from 'three';
import type { TscnScene, ResourceNeededCallback, MissingResource } from '../parser/types';
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
  private onResourceNeeded: ResourceNeededCallback | null = null;

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
   * Set the resource needed callback (called when external scene fails to load)
   */
  setOnResourceNeeded(callback: ResourceNeededCallback | undefined): void {
    this.onResourceNeeded = callback || null;
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

    // Share ResourceRegistry with external scene
    scene.resourceRegistry = this.resourceRegistry;

    // Register external scene's own resources in shared registry
    // This allows nested external scenes (L2+) to resolve their own dependencies
    for (const extResource of scene.externalResources) {
      this.resourceRegistry.register(extResource);
      logger.info(
        `[SceneManager] Registered resource from ${scenePath}: ${extResource.id} → ${extResource.path}`
      );
    }

    this.sceneCache.set(scenePath, scene);
    logger.info(`[SceneManager] Cached parsed scene: ${scenePath} with ${scene.nodes.length} root nodes`);

    return scene;
  }

  /**
   * Recursively set userData.instanceRoot on an object and all its descendants
   * Skips children that already have a different instanceRoot (nested instances)
   */
  private setInstanceRootOnDescendants(object: THREE.Object3D, instancePath: string): void {
    object.userData.instanceRoot = instancePath;
    for (const child of object.children) {
      const existingInstanceRoot = child.userData.instanceRoot as string | undefined;

      // If child already has a different instanceRoot, it's a nested instance - don't overwrite
      if (existingInstanceRoot && existingInstanceRoot !== instancePath) {
        continue;
      }

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

    // Track this instance BEFORE attempting load
    // This ensures hot-reload works even if initial load fails
    if (!this.sceneInstances.has(scenePath)) {
      this.sceneInstances.set(scenePath, new Set());
    }
    this.sceneInstances.get(scenePath)!.add(instancePath);
    logger.info(
      `[SceneManager] Tracking instance: ${instancePath} (total instances of ${scenePath}: ${this.sceneInstances.get(scenePath)!.size})`
    );

    try {
      // Load the external scene
      const externalScene = await this.loadScene(scenePath);

      // Add all root nodes from external scene as children of instance node
      await this.addExternalSceneNodes(externalScene, instancePath);

      logger.info(`[SceneManager] ✅ Successfully added scene instance: ${instancePath}`);
    } catch (error) {
      logger.warn(`[SceneManager] Failed to load external scene: ${scenePath}`, error);

      // Call onResourceNeeded callback if available
      if (this.onResourceNeeded) {
        const missingResource: MissingResource = {
          path: scenePath,
          type: 'PackedScene',
          referencedBy: instancePath,
          error: error instanceof Error ? error.message : String(error)
        };
        logger.info(`[SceneManager] Calling onResourceNeeded for: ${scenePath}`);
        await this.onResourceNeeded(missingResource);
      } else {
        logger.warn(`[SceneManager] No onResourceNeeded callback set, cannot notify about missing resource: ${scenePath}`);
      }

      // Don't re-throw - allow rendering to continue with other nodes
    }
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
   * Provide missing external scene - add content to instances without removing existing children
   * Used when user uploads a previously missing external scene file
   * Unlike updateScene(), this does NOT remove existing children
   */
  async provideScene(scenePath: string): Promise<void> {
    if (!this.nodeLifecycle) {
      throw new Error('NodeLifecycleManager not set. Call setNodeLifecycleManager() first.');
    }

    if (!this.resourceRegistry) {
      throw new Error('ResourceRegistry not set. Call setResourceRegistry() first.');
    }

    // Find all instances waiting for this scene
    const instances = this.sceneInstances.get(scenePath);
    if (!instances || instances.size === 0) {
      logger.info(`[SceneManager] No instances found for ${scenePath}, nothing to provide`);
      return;
    }

    logger.info(`[SceneManager] 📦 Providing missing external scene: ${scenePath}`);

    // Clear cache to force reload
    this.sceneCache.delete(scenePath);
    this.resourceRegistry.clearCache(scenePath);
    logger.info(`[SceneManager] Cleared caches for: ${scenePath}`);

    // Load the scene
    const providedScene = await this.loadScene(scenePath);

    logger.info(`[SceneManager] Providing content to ${instances.size} instances of ${scenePath}`);

    // Provide content to each instance
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

        logger.info(`[SceneManager] Providing content to instance: ${instancePath}`);

        // Check if the external scene's root nodes already exist
        // (Check for specific nodes from the external scene, not just any children)
        const externalNodesAlreadyExist = providedScene.nodes.every(externalNode => {
          const childPath = joinPath(instancePath, externalNode.name);
          return this.nodeTracker.has(childPath);
        });

        if (externalNodesAlreadyExist) {
          logger.info(`[SceneManager] Instance ${instancePath} already has external scene content, skipping`);
          continue;
        }

        // Add external scene nodes as children (does NOT remove existing children)
        // This will now correctly add external scene nodes even if inline children exist
        await this.addExternalSceneNodes(providedScene, instancePath);

        successCount++;
        logger.info(`[SceneManager] ✓ Provided content to instance: ${instancePath}`);
      } catch (error) {
        logger.error(`[SceneManager] ✗ Failed to provide content to instance ${instancePath}:`, error);
      }
    }

    logger.info(`[SceneManager] ✅ Provision complete for ${scenePath}: ${successCount}/${instances.size} instances received content`);
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
