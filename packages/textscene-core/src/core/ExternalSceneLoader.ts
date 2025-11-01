/**
 * Handles loading of external scene instances.
 */

import * as THREE from 'three';
import type { TscnScene, TscnNode, MissingResource, ResourceNeededCallback } from '../parser/types';
import { TscnParser } from '../parser/TscnParser';
import { ResourceRegistry } from '../resources/ResourceRegistry';
import { NodeTracker } from './NodeTracker';
import * as logger from '../logger';
import { joinPath } from '../utils/nodePath';

export class ExternalSceneLoader {
  private nodeTracker: NodeTracker;
  private instanceLoadingStack: Set<string> = new Set();
  private missingResources: Map<string, MissingResource>;
  private onResourceNeeded?: ResourceNeededCallback;
  private parser: TscnParser = new TscnParser();
  private addNodeCallback: (
    nodePath: string,
    node: TscnNode,
    sceneData: TscnScene,
    parentPath?: string,
    externalSceneContext?: { instancePath: string; parentObject: THREE.Object3D }
  ) => Promise<void>;

  constructor(
    nodeTracker: NodeTracker,
    missingResources: Map<string, MissingResource>,
    addNodeCallback: (
      nodePath: string,
      node: TscnNode,
      sceneData: TscnScene,
      parentPath?: string,
      externalSceneContext?: { instancePath: string; parentObject: THREE.Object3D }
    ) => Promise<void>,
    onResourceNeeded?: ResourceNeededCallback
  ) {
    this.nodeTracker = nodeTracker;
    this.missingResources = missingResources;
    this.addNodeCallback = addNodeCallback;
    this.onResourceNeeded = onResourceNeeded;
  }

  /**
   * Load an external scene instance
   */
  async loadExternalSceneInstance(
    instancePath: string,
    instanceNode: TscnNode,
    parentSceneData: TscnScene,
    instanceObject: THREE.Object3D
  ): Promise<void> {
    let resourcePath: string | null = null;

    try {
      logger.info(`[External Scene] Starting to load for instance: ${instancePath}`);

      // Parse the ExtResource reference
      const resourceId = ResourceRegistry.parseReference(instanceNode.instance!);
      logger.info(`[External Scene] Parsed resource ID: ${resourceId} from: ${instanceNode.instance}`);

      if (!resourceId) {
        logger.warn(`Invalid instance reference: ${instanceNode.instance}`);
        return;
      }

      // Get resource metadata
      const registry = parentSceneData.resourceRegistry;
      if (!registry) {
        logger.warn('No resource registry available for external scene loading');
        return;
      }

      logger.info(`[External Scene] Looking up resource ID "${resourceId}" in registry`);
      const resourceMetadata = registry.getMetadata(resourceId);
      if (!resourceMetadata) {
        logger.warn(`External resource not found: ${resourceId}`);
        logger.info(
          `[External Scene] Available resources:`,
          registry.getAllResources().map(r => `id="${r.id}" path="${r.path}"`)
        );
        return;
      }

      logger.info(
        `[External Scene] Found resource metadata: id="${resourceMetadata.id}" path="${resourceMetadata.path}" type="${resourceMetadata.type}"`
      );

      // Validate resource type - must be PackedScene for instancing
      if (resourceMetadata.type !== 'PackedScene') {
        logger.error(
          `[External Scene] Cannot instance non-scene resource: type="${resourceMetadata.type}" path="${resourceMetadata.path}"`
        );
        logger.error(`[External Scene] Instance attribute must reference a PackedScene resource`);
        return;
      }

      // Check for circular dependencies
      if (this.instanceLoadingStack.has(resourceMetadata.path)) {
        logger.error(`[External Scene] Circular dependency detected: ${resourceMetadata.path}`);
        logger.error(
          `[External Scene] Loading stack: ${Array.from(this.instanceLoadingStack).join(' → ')} → ${resourceMetadata.path}`
        );
        return;
      }

      // Mark instance node as external scene instance
      instanceObject.userData.isExternalSceneInstance = true;
      instanceObject.userData.externalScenePath = resourceMetadata.path;
      instanceObject.userData.externalSceneUid = resourceMetadata.id;

      // Track this instance loading to detect circular dependencies
      resourcePath = resourceMetadata.path;
      this.instanceLoadingStack.add(resourcePath);
      logger.info(`[External Scene] Loading and parsing from: ${resourcePath}`);

      // Try to load and parse the external scene (uses caching)
      let externalScene: TscnScene | null = null;
      try {
        externalScene = await registry.loadAndParseScene(resourceId, this.parser);
      } catch (loadError) {
        // Track as missing resource
        const missingResource: MissingResource = {
          path: resourceMetadata.path,
          type: resourceMetadata.type,
          referencedBy: instancePath,
          error: loadError instanceof Error ? loadError.message : 'Unknown error',
        };
        this.missingResources.set(resourceMetadata.path, missingResource);
        logger.warn(`[External Scene] Resource not available: ${resourceMetadata.path}`);

        // Call app's callback if provided
        if (this.onResourceNeeded) {
          logger.info(`[External Scene] Calling onResourceNeeded callback for: ${resourceMetadata.path}`);
          try {
            const providedContent = await this.onResourceNeeded(missingResource);
            if (providedContent && typeof providedContent === 'string') {
              logger.info(`[External Scene] App provided resource, parsing: ${resourceMetadata.path}`);
              externalScene = this.parser.parse(providedContent);
              this.missingResources.delete(resourceMetadata.path);
            } else if (providedContent) {
              logger.warn(`[External Scene] App provided non-string content: ${typeof providedContent}`);
            } else {
              logger.info(`[External Scene] App did not provide resource, remaining in missing list`);
            }
          } catch (callbackError) {
            logger.error(`[External Scene] onResourceNeeded callback threw error:`, callbackError);
          }
        }

        // If still no scene after callback, bail out
        if (!externalScene) {
          return;
        }
      }

      // Render external scene nodes as children of instance node
      const externalContext = { instancePath, parentObject: instanceObject };
      for (const externalNode of externalScene.nodes) {
        const externalNodePath = joinPath(instancePath, externalNode.name);
        logger.info(`[External Scene] Adding external node: ${externalNode.name} at path: ${externalNodePath}`);
        await this.addNodeCallback(externalNodePath, externalNode, externalScene, undefined, externalContext);
      }

      logger.info(
        `[External Scene] ✅ Successfully loaded external scene: ${resourceMetadata.path} with ${externalScene.nodes.length} nodes`
      );
    } catch (error) {
      logger.error(`[External Scene] ❌ Failed to load external scene for ${instancePath}:`, error);
    } finally {
      // Always remove from loading stack, even on error
      if (resourcePath) {
        this.instanceLoadingStack.delete(resourcePath);
      }
    }
  }

  /**
   * Clear circular dependency tracking
   */
  clearLoadingStack(): void {
    this.instanceLoadingStack.clear();
  }
}
