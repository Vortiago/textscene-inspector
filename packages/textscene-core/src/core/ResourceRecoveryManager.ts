/**
 * Manages missing resources and recovery workflow.
 */

import * as THREE from 'three';
import type { MissingResource, TscnScene, TscnNode } from '../parser/types';
import { NodeTracker } from './NodeTracker';
import * as logger from '../logger';

export class ResourceRecoveryManager {
  private missingResources: Map<string, MissingResource> = new Map();
  private nodeTracker: NodeTracker;
  private loadExternalSceneCallback: (
    instancePath: string,
    instanceNode: TscnNode,
    sceneData: TscnScene,
    instanceObject: THREE.Object3D
  ) => Promise<void>;
  private getCurrentSceneData: () => TscnScene | null;

  constructor(
    nodeTracker: NodeTracker,
    loadExternalSceneCallback: (
      instancePath: string,
      instanceNode: TscnNode,
      sceneData: TscnScene,
      instanceObject: THREE.Object3D
    ) => Promise<void>,
    getCurrentSceneData: () => TscnScene | null
  ) {
    this.nodeTracker = nodeTracker;
    this.loadExternalSceneCallback = loadExternalSceneCallback;
    this.getCurrentSceneData = getCurrentSceneData;
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

    const sceneData = this.getCurrentSceneData();
    if (!sceneData) {
      logger.error(`provideResource: No scene data available`);
      return;
    }

    logger.info(`[Resource Provided] Re-attempting load of: ${path} for node: ${missingResource.referencedBy}`);

    // Find the node object in THREE.js scene
    const instanceObject = this.nodeTracker.getObject(missingResource.referencedBy);
    if (!instanceObject) {
      logger.error(`[Resource Provided] Could not find node object: ${missingResource.referencedBy}`);
      return;
    }

    // Find the TscnNode
    const tscnNode = this.nodeTracker.getNode(missingResource.referencedBy);
    if (!tscnNode) {
      logger.error(`[Resource Provided] Could not find TscnNode: ${missingResource.referencedBy}`);
      return;
    }

    // Remove from missing list (will be re-added if it fails again)
    this.missingResources.delete(path);

    // Re-attempt to load the external scene
    try {
      await this.loadExternalSceneCallback(
        missingResource.referencedBy,
        tscnNode,
        sceneData,
        instanceObject
      );
      logger.info(`[Resource Provided] ✅ Successfully loaded: ${path}`);
    } catch (error) {
      logger.error(`[Resource Provided] ❌ Failed to load: ${path}`, error);
    }
  }
}
