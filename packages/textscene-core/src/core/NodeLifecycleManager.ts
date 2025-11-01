/**
 * Manages node lifecycle: add, remove, update operations.
 */

import * as THREE from 'three';
import type { TscnScene, TscnNode } from '../parser/types';
import { renderNodeWithRegistry } from './NodeRegistry';
import { NodeTracker } from './NodeTracker';
import type { SceneManager } from './SceneManager';
import { ResourceRegistry } from '../resources/ResourceRegistry';
import * as logger from '../logger';
import { joinPath } from '../utils/nodePath';

export class NodeLifecycleManager {
  private scene: THREE.Scene;
  private nodeTracker: NodeTracker;
  private sceneManager: SceneManager | null = null;

  constructor(scene: THREE.Scene, nodeTracker: NodeTracker) {
    this.scene = scene;
    this.nodeTracker = nodeTracker;
  }

  /**
   * Set the scene manager (called after construction to break circular dependency)
   */
  setSceneManager(sceneManager: SceneManager): void {
    this.sceneManager = sceneManager;
  }

  /**
   * Add a node to the scene
   */
  async addNode(
    nodePath: string,
    node: TscnNode,
    sceneData: TscnScene,
    parentPath?: string
  ): Promise<void> {
    // Determine parent
    const parent = parentPath ? this.nodeTracker.getObject(parentPath) : this.scene;

    if (!parent) {
      logger.warn(`Parent not found for node: ${nodePath}`);
      return;
    }

    // Render node
    const object3D = renderNodeWithRegistry(node, sceneData);
    if (!object3D) {
      logger.warn(`Failed to render node: ${node.name} (type: ${node.type})`);
      return;
    }

    // Set common userData
    object3D.userData.nodePath = nodePath;
    object3D.userData.nodeName = node.name;

    this.nodeTracker.set(nodePath, object3D, node);
    parent.add(object3D);

    // Handle external scene instance (delegate to SceneManager)
    if (node.instance) {
      if (!this.sceneManager) {
        logger.warn(`SceneManager not set, cannot load instance: ${nodePath}`);
        return;
      }

      logger.info(`Node ${nodePath} has instance attribute: ${node.instance}`);

      const resourceId = ResourceRegistry.parseReference(node.instance);
      if (!resourceId) {
        logger.warn(`Invalid instance reference: ${node.instance}`);
        return;
      }

      const metadata = sceneData.resourceRegistry?.getMetadata(resourceId);
      if (!metadata || metadata.type !== 'PackedScene') {
        logger.warn(`Invalid PackedScene reference: ${resourceId}`);
        return;
      }

      // Set instance metadata for UI layer
      node.instanceMetadata = {
        sourcePath: metadata.path,
        isInstanceRoot: true
      };

      // Delegate to SceneManager
      await this.sceneManager.addScene(nodePath, metadata.path, object3D, sceneData);
    }

    // Recursively add children
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        const childPath = joinPath(nodePath, child.name);
        await this.addNode(childPath, child, sceneData, nodePath);
      }
    }
  }

  /**
   * Remove a node from the scene
   */
  removeNode(nodePath: string): void {
    const object = this.nodeTracker.getObject(nodePath);
    if (!object) {
      logger.warn(`Node not found for removal: ${nodePath}`);
      return;
    }

    // Remove from scene
    if (object.parent) {
      object.parent.remove(object);
    }

    // Clean up from maps (including children)
    const pathsToRemove: string[] = [];
    for (const path of this.nodeTracker.getAllPaths()) {
      if (path === nodePath || path.startsWith(nodePath + '/')) {
        pathsToRemove.push(path);
      }
    }
    pathsToRemove.forEach(path => {
      this.nodeTracker.delete(path);
    });
  }

  /**
   * Update a node (remove old, add new)
   */
  async updateNode(nodePath: string, node: TscnNode, sceneData: TscnScene): Promise<void> {
    const object = this.nodeTracker.getObject(nodePath);
    if (!object) {
      logger.warn(`Node not found for update: ${nodePath}`);
      return;
    }

    // Find parent path from object
    const parentPath = object.parent?.userData?.nodePath;

    // Remove old node
    this.removeNode(nodePath);

    // Add new node
    await this.addNode(nodePath, node, sceneData, parentPath);
  }

  /**
   * Set node visibility
   */
  setNodeVisibility(nodePath: string, visible: boolean): void {
    const object = this.nodeTracker.getObject(nodePath);
    if (!object) {
      logger.warn(`Node not found for visibility change: ${nodePath}`);
      return;
    }
    object.visible = visible;
  }
}
