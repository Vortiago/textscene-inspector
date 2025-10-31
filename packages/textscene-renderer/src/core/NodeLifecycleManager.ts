/**
 * Manages node lifecycle: add, remove, update operations.
 */

import * as THREE from 'three';
import type { TscnScene, TscnNode } from '../parser/types';
import { renderNodeWithRegistry } from './NodeRegistry';
import { NodeTracker } from './NodeTracker';
import { ExternalSceneLoader } from './ExternalSceneLoader';
import * as logger from '../logger';
import { joinPath } from '../utils/nodePath';

export class NodeLifecycleManager {
  private scene: THREE.Scene;
  private nodeTracker: NodeTracker;
  private externalSceneLoader: ExternalSceneLoader;

  constructor(scene: THREE.Scene, nodeTracker: NodeTracker, externalSceneLoader: ExternalSceneLoader) {
    this.scene = scene;
    this.nodeTracker = nodeTracker;
    this.externalSceneLoader = externalSceneLoader;
  }

  /**
   * Add a node to the scene
   */
  async addNode(
    nodePath: string,
    node: TscnNode,
    sceneData: TscnScene,
    parentPath?: string,
    externalSceneContext?: { instancePath: string; parentObject: THREE.Object3D }
  ): Promise<void> {
    // Determine parent
    const parent = externalSceneContext
      ? externalSceneContext.parentObject
      : parentPath
        ? this.nodeTracker.getObject(parentPath)
        : this.scene;

    if (!parent) {
      logger.warn(`Parent not found for node: ${nodePath}`);
      return;
    }

    // Render node
    if (externalSceneContext) {
      logger.info(`[External Scene Node] Rendering node: ${node.name} (type: ${node.type}) at path: ${nodePath}`);
    }

    const object3D = renderNodeWithRegistry(node, sceneData);
    if (!object3D) {
      if (externalSceneContext) {
        logger.warn(`[External Scene Node] Failed to render node: ${node.name} (type: ${node.type})`);
      }
      return;
    }

    if (externalSceneContext) {
      logger.info(
        `[External Scene Node] Successfully rendered ${node.name}, adding to parent "${parent.userData.nodeName || 'scene'}"`
      );
    }

    // Set common userData
    object3D.userData.nodePath = nodePath;
    object3D.userData.nodeName = node.name;

    // Set external scene specific userData
    if (externalSceneContext) {
      object3D.userData.isExternalSceneContent = true;
      object3D.userData.belongsToExternalInstance = externalSceneContext.instancePath;
    }

    this.nodeTracker.set(nodePath, object3D, node);
    parent.add(object3D);

    if (externalSceneContext) {
      logger.info(
        `[External Scene Node] Added ${node.name} to scene graph. Parent now has ${parent.children.length} children`
      );
    }

    // Handle external scene instance (nested instances are allowed)
    if (node.instance) {
      logger.info(`Node ${nodePath} has instance attribute: ${node.instance}`);
      await this.externalSceneLoader.loadExternalSceneInstance(nodePath, node, sceneData, object3D);
    }

    // Recursively add children
    if (node.children && node.children.length > 0) {
      if (externalSceneContext) {
        logger.info(`[External Scene Node] Processing ${node.children.length} children of ${node.name}`);
      }
      for (const child of node.children) {
        const childPath = joinPath(nodePath, child.name);
        await this.addNode(childPath, child, sceneData, nodePath, externalSceneContext);
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
