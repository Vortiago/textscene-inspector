/**
 * Renders parsed TSCN scenes using three.js.
 */

import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { TscnScene, TscnNode, MissingResource, ResourceNeededCallback } from '../parser/types';
import { renderNodeWithRegistry } from './NodeRegistry';
import { setupThreeJsScene } from './SceneSetup';
import { ResourceRegistry } from '../resources/ResourceRegistry';
import { TscnParser } from '../parser/TscnParser';
import * as logger from '../logger';
import { getParentPath, joinPath } from '../utils/nodePath';

export interface CameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

export interface TscnRendererOptions {
  /** Callback invoked when renderer needs a resource that isn't available */
  onResourceNeeded?: ResourceNeededCallback;
}

export class TscnRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private nodePathMap: Map<string, THREE.Object3D> = new Map();
  private tscnNodeMap: Map<string, TscnNode> = new Map(); // Track all TscnNode objects including external
  private helpers: Map<string, THREE.BoxHelper> = new Map();
  private raycaster: THREE.Raycaster;
  private missingResources: Map<string, MissingResource> = new Map();
  private options: TscnRendererOptions;
  private currentSceneData: TscnScene | null = null;
  private renderInProgress: Promise<void> | null = null;
  private instanceLoadingStack: Set<string> = new Set(); // Track loading instances to detect circular dependencies

  constructor(canvas: HTMLCanvasElement, options: TscnRendererOptions = {}) {
    logger.info('Initializing TscnRenderer');
    this.options = options;
    const components = setupThreeJsScene(canvas);
    this.scene = components.scene;
    this.camera = components.camera;
    this.renderer = components.renderer;
    this.controls = components.controls;
    this.raycaster = new THREE.Raycaster();
  }

  async render(sceneData: TscnScene): Promise<void> {
    // Wait for previous render to complete to prevent race conditions
    if (this.renderInProgress) {
      logger.info('Waiting for previous render to complete before starting new render');
      await this.renderInProgress;
    }

    // Create new render promise and track it
    this.renderInProgress = this.performRender(sceneData);

    try {
      await this.renderInProgress;
    } finally {
      this.renderInProgress = null;
    }
  }

  private async performRender(sceneData: TscnScene): Promise<void> {
    logger.info(`Rendering scene with ${sceneData.nodes.length} root nodes`);
    this.currentSceneData = sceneData;

    const objectsToRemove: THREE.Object3D[] = [];
    this.scene.children.forEach((child: THREE.Object3D) => {
      if (!(child instanceof THREE.Light) && !(child instanceof THREE.GridHelper)) {
        objectsToRemove.push(child);
      }
    });
    objectsToRemove.forEach(obj => this.scene.remove(obj));

    this.nodePathMap.clear();
    this.tscnNodeMap.clear();
    this.clearAllHelpers();
    this.instanceLoadingStack.clear(); // Clear circular dependency tracking for new scene

    // Use addNode for each root node to ensure consistent code path
    for (const node of sceneData.nodes) {
      await this.addNode(node.name, node, sceneData);
    }
    logger.info('Rendering complete');
  }

  async addNode(
    nodePath: string,
    node: TscnNode,
    sceneData: TscnScene,
    parentPath?: string,
    externalSceneContext?: { instancePath: string; parentObject: THREE.Object3D }
  ): Promise<void> {
    // Determine parent: use externalSceneContext.parentObject for external nodes, otherwise resolve by path
    const parent = externalSceneContext
      ? externalSceneContext.parentObject
      : (parentPath ? this.nodePathMap.get(parentPath) : this.scene);

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
      logger.info(`[External Scene Node] Successfully rendered ${node.name}, adding to parent "${parent.userData.nodeName || 'scene'}"`);
    }

    // Set common userData
    object3D.userData.nodePath = nodePath;
    object3D.userData.nodeName = node.name;

    // Set external scene specific userData
    if (externalSceneContext) {
      object3D.userData.isExternalSceneContent = true;
      object3D.userData.belongsToExternalInstance = externalSceneContext.instancePath;
    }

    this.nodePathMap.set(nodePath, object3D);
    this.tscnNodeMap.set(nodePath, node); // Track TscnNode for later lookup
    parent.add(object3D);

    if (externalSceneContext) {
      logger.info(`[External Scene Node] Added ${node.name} to scene graph. Parent now has ${parent.children.length} children`);
    }

    // Handle external scene instance (nested instances are allowed)
    if (node.instance) {
      logger.info(`Node ${nodePath} has instance attribute: ${node.instance}`);
      await this.loadExternalSceneInstance(nodePath, node, sceneData, object3D);
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

  private async loadExternalSceneInstance(
    instancePath: string,
    instanceNode: TscnNode,
    parentSceneData: TscnScene,
    instanceObject: THREE.Object3D
  ): Promise<void> {
    let resourcePath: string | null = null; // Track for cleanup in finally block

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
        logger.info(`[External Scene] Available resources:`, registry.getAllResources().map(r => `id="${r.id}" path="${r.path}"`));
        return;
      }

      logger.info(`[External Scene] Found resource metadata: id="${resourceMetadata.id}" path="${resourceMetadata.path}" type="${resourceMetadata.type}"`);

      // Validate resource type - must be PackedScene for instancing
      if (resourceMetadata.type !== 'PackedScene') {
        logger.error(`[External Scene] Cannot instance non-scene resource: type="${resourceMetadata.type}" path="${resourceMetadata.path}"`);
        logger.error(`[External Scene] Instance attribute must reference a PackedScene resource`);
        return;
      }

      // Check for circular dependencies
      if (this.instanceLoadingStack.has(resourceMetadata.path)) {
        logger.error(`[External Scene] Circular dependency detected: ${resourceMetadata.path}`);
        logger.error(`[External Scene] Loading stack: ${Array.from(this.instanceLoadingStack).join(' → ')} → ${resourceMetadata.path}`);
        return;
      }

      // Mark instance node as external scene instance
      instanceObject.userData.isExternalSceneInstance = true;
      instanceObject.userData.externalScenePath = resourceMetadata.path;
      instanceObject.userData.externalSceneUid = resourceMetadata.id;

      // Track this instance loading to detect circular dependencies
      resourcePath = resourceMetadata.path; // Store for cleanup in finally block
      this.instanceLoadingStack.add(resourcePath);
      logger.info(`[External Scene] Loading content from: ${resourcePath}`);

      // Try to load the external scene
      let externalSceneContent: string | ArrayBuffer | null = null;
      try {
        externalSceneContent = await registry.loadByPath(resourceId);
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
        if (this.options.onResourceNeeded) {
          logger.info(`[External Scene] Calling onResourceNeeded callback for: ${resourceMetadata.path}`);
          try {
            const providedContent = await this.options.onResourceNeeded(missingResource);
            if (providedContent) {
              logger.info(`[External Scene] App provided resource immediately: ${resourceMetadata.path}`);
              externalSceneContent = providedContent;
              this.missingResources.delete(resourceMetadata.path);
            } else {
              logger.info(`[External Scene] App did not provide resource, remaining in missing list`);
            }
          } catch (callbackError) {
            logger.error(`[External Scene] onResourceNeeded callback threw error:`, callbackError);
          }
        }

        // If still no content after callback, bail out
        if (!externalSceneContent) {
          return;
        }
      }

      logger.info(`[External Scene] Loaded content type: ${typeof externalSceneContent}, length: ${typeof externalSceneContent === 'string' ? externalSceneContent.length : 'N/A'}`);

      // Parse the external scene if it's a string (text content)
      if (typeof externalSceneContent === 'string') {
        const parser = new TscnParser();
        const externalScene = parser.parse(externalSceneContent);
        logger.info(`[External Scene] Parsed scene with ${externalScene.nodes.length} root nodes`);

        // Render external scene nodes as children of instance node
        const externalContext = { instancePath, parentObject: instanceObject };
        for (const externalNode of externalScene.nodes) {
          const externalNodePath = joinPath(instancePath, externalNode.name);
          logger.info(`[External Scene] Adding external node: ${externalNode.name} at path: ${externalNodePath}`);
          await this.addNode(externalNodePath, externalNode, externalScene, undefined, externalContext);
        }

        logger.info(`[External Scene] ✅ Successfully loaded external scene: ${resourceMetadata.path} with ${externalScene.nodes.length} nodes`);
      } else {
        logger.warn(`[External Scene] Expected string content but got: ${typeof externalSceneContent}`);
      }
    } catch (error) {
      logger.error(`[External Scene] ❌ Failed to load external scene for ${instancePath}:`, error);
    } finally {
      // Always remove from loading stack, even on error
      if (resourcePath) {
        this.instanceLoadingStack.delete(resourcePath);
      }
    }
  }

  removeNode(nodePath: string): void {
    const object = this.nodePathMap.get(nodePath);
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
    this.nodePathMap.forEach((_, path) => {
      if (path === nodePath || path.startsWith(nodePath + '/')) {
        pathsToRemove.push(path);
      }
    });
    pathsToRemove.forEach(path => {
      this.nodePathMap.delete(path);
      this.tscnNodeMap.delete(path);
    });
  }

  async updateNode(nodePath: string, node: TscnNode, sceneData: TscnScene): Promise<void> {
    // Simple update: remove and re-add the node
    const object = this.nodePathMap.get(nodePath);
    if (!object) {
      logger.warn(`Node not found for update: ${nodePath}`);
      return;
    }

    const parent = object.parent;
    if (!parent) {
      return;
    }

    // Determine parent path
    const parentPath = getParentPath(nodePath) || undefined;

    this.removeNode(nodePath);
    await this.addNode(nodePath, node, sceneData, parentPath);
  }


  startAnimationLoop(): void {
    const animate = () => {
      requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  resetCamera(): void {
    this.camera.position.set(10, 10, 10);
    this.camera.lookAt(0, 0, 0);
    this.controls.reset();
  }

  getCameraState(): CameraState {
    return {
      position: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z,
      },
      target: {
        x: this.controls.target.x,
        y: this.controls.target.y,
        z: this.controls.target.z,
      },
    };
  }

  setCameraState(state: CameraState): void {
    this.camera.position.set(state.position.x, state.position.y, state.position.z);
    this.controls.target.set(state.target.x, state.target.y, state.target.z);
    this.controls.update();
  }

  getNodePathAtScreenPosition(x: number, y: number): string | null {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();

    // Convert to normalized device coordinates (-1 to +1)
    const mouse = new THREE.Vector2(
      ((x - rect.left) / rect.width) * 2 - 1,
      -((y - rect.top) / rect.height) * 2 + 1
    );

    this.raycaster.setFromCamera(mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    for (const intersection of intersects) {
      const nodePath = this.findNodePathInHierarchy(intersection.object);
      if (nodePath) {
        // Only return paths for mesh objects (filter out lights, cameras, etc.)
        const object = this.nodePathMap.get(nodePath);
        if (object && this.isMeshObject(object)) {
          return nodePath;
        }
      }
    }

    return null;
  }

  private findNodePathInHierarchy(object: THREE.Object3D): string | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current.userData.nodePath) {
        // If this node belongs to an external scene, return the instance node path instead
        if (current.userData.isExternalSceneContent && current.userData.belongsToExternalInstance) {
          return current.userData.belongsToExternalInstance;
        }
        return current.userData.nodePath;
      }
      current = current.parent;
    }
    return null;
  }

  private isMeshObject(object: THREE.Object3D): boolean {
    let hasMesh = false;
    object.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        hasMesh = true;
      }
    });
    return hasMesh;
  }

  private setHelper(key: string, nodePath: string, color: number): void {
    this.clearHelper(key);

    const object = this.nodePathMap.get(nodePath);
    if (!object) {
      if (key === 'highlight') {
        logger.warn(`Node not found for highlighting: ${nodePath}`);
      }
      return;
    }

    const helper = new THREE.BoxHelper(object, color);
    this.helpers.set(key, helper);
    this.scene.add(helper);
  }

  private clearHelper(key: string): void {
    const helper = this.helpers.get(key);
    if (helper) {
      this.scene.remove(helper);
      helper.dispose();
      this.helpers.delete(key);
    }
  }

  private clearAllHelpers(): void {
    this.helpers.forEach((helper) => {
      this.scene.remove(helper);
      helper.dispose();
    });
    this.helpers.clear();
  }

  highlightNode(nodePath: string): void {
    this.clearHelper('hover');
    this.setHelper('highlight', nodePath, 0x00ff00);
  }

  clearHighlight(): void {
    this.clearHelper('highlight');
  }

  showHoverEffect(nodePath: string): void {
    this.setHelper('hover', nodePath, 0xff8800);
  }

  clearHoverEffect(): void {
    this.clearHelper('hover');
  }

  setNodeVisibility(nodePath: string, visible: boolean): void {
    const object = this.nodePathMap.get(nodePath);
    if (!object) {
      logger.warn(`Node not found for visibility change: ${nodePath}`);
      return;
    }

    object.visible = visible;
  }

  /**
   * Get list of resources that failed to load during rendering.
   * Apps can display this list to prompt users to provide missing files.
   */
  getMissingResources(): MissingResource[] {
    return Array.from(this.missingResources.values());
  }

  /**
   * Provide a previously missing resource and re-render affected nodes.
   *
   * IMPORTANT: Before calling this, the app must add the resource to the provider's cache:
   * - Web: resourceProvider.addUploadedFile(path, file)
   * - VSCode: resourceProvider should already find it in workspace
   *
   * @param path - Godot resource path (must match MissingResource.path)
   */
  async provideResource(path: string): Promise<void> {
    const missingResource = this.missingResources.get(path);
    if (!missingResource) {
      logger.warn(`provideResource called for non-missing resource: ${path}`);
      return;
    }

    if (!this.currentSceneData) {
      logger.error(`provideResource: No scene data available`);
      return;
    }

    logger.info(`[Resource Provided] Re-attempting load of: ${path} for node: ${missingResource.referencedBy}`);

    // Find the node object in THREE.js scene
    const instanceObject = this.nodePathMap.get(missingResource.referencedBy);
    if (!instanceObject) {
      logger.error(`[Resource Provided] Could not find node object: ${missingResource.referencedBy}`);
      return;
    }

    // Find the TscnNode (including dynamically created external scene nodes)
    const tscnNode = this.tscnNodeMap.get(missingResource.referencedBy);
    if (!tscnNode) {
      logger.error(`[Resource Provided] Could not find TscnNode: ${missingResource.referencedBy}`);
      return;
    }

    // Remove from missing list (will be re-added if it fails again)
    this.missingResources.delete(path);

    // Re-attempt to load the external scene
    try {
      await this.loadExternalSceneInstance(
        missingResource.referencedBy,
        tscnNode,
        this.currentSceneData,
        instanceObject
      );
      logger.info(`[Resource Provided] ✅ Successfully loaded: ${path}`);
    } catch (error) {
      logger.error(`[Resource Provided] ❌ Failed to load: ${path}`, error);
    }
  }

  dispose(): void {
    this.clearAllHelpers();
    this.renderer.dispose();
  }
}
