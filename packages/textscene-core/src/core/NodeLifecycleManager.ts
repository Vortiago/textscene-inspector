/**
 * Manages node lifecycle: add, remove, update operations.
 *
 * INVARIANTS (must hold at all times):
 *
 * 1. Three-way synchronization:
 *    - TscnNode tree structure (parser output, used by UI)
 *    - THREE.js scene graph (3D rendering)
 *    - NodeTracker maps (bidirectional lookups)
 *
 * 2. If nodeTracker has (path -> object, node), then:
 *    - object.userData.nodePath === path
 *    - object.userData.nodeName === node.name
 *
 * 3. Parent-child relationships must be consistent:
 *    - If node has parent at parentPath, then:
 *      - parentNode.children includes node
 *      - object.parent === parentObject
 *      - Both relationships exist in NodeTracker
 *
 * 4. Path hierarchy integrity:
 *    - If path "A/B/C" exists in tracker
 *    - Then ancestors "A" and "A/B" must also exist
 *
 * 5. Removal cascades:
 *    - Removing node at path "A/B" removes all descendants "A/B/*"
 *    - Parent's children array updated to remove node
 */

import * as THREE from 'three';
import type { TscnScene, TscnNode } from '../parser/types';
import { renderNodeWithRegistry } from './NodeRegistry';
import { NodeTracker } from './NodeTracker';
import type { SceneManager } from './SceneManager';
import { ResourceRegistry } from '../resources/ResourceRegistry';
import * as logger from '../logger';
import { joinPath } from '../utils/nodePath';

/**
 * Events emitted by NodeLifecycleManager when nodes are added, removed, or updated.
 * Allows UI components to reactively update without tight coupling.
 */
export type NodeLifecycleEvent =
  | { type: 'nodeAdded'; nodePath: string; node: TscnNode }
  | { type: 'nodeRemoved'; nodePath: string }
  | { type: 'nodeUpdated'; nodePath: string; node: TscnNode };

type EventListener = (event: NodeLifecycleEvent) => void;

export class NodeLifecycleManager {
  private scene: THREE.Scene;
  private nodeTracker: NodeTracker;
  private sceneManager: SceneManager | null = null;
  private listeners: EventListener[] = [];

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
   * Add an event listener for node lifecycle events
   */
  addEventListener(listener: EventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove an event listener
   */
  removeEventListener(listener: EventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: NodeLifecycleEvent): void {
    this.listeners.forEach(listener => listener(event));
  }

  /**
   * Synchronize all three data structures after adding a node.
   * MUST be called after rendering and before returning from addNode().
   *
   * This helper centralizes the three-way sync logic:
   * 1. THREE.js userData (nodePath, nodeName)
   * 2. NodeTracker bidirectional maps
   * 3. TscnNode.children array
   * 4. THREE.js scene graph parent-child relationship
   * 5. Invariant verification (dev mode only)
   */
  private syncNodeAdd(
    nodePath: string,
    node: TscnNode,
    object3D: THREE.Object3D,
    parent: THREE.Object3D | null,
    parentPath?: string
  ): void {
    // 1. Set userData
    object3D.userData.nodePath = nodePath;
    object3D.userData.nodeName = node.name;

    // 2. Update NodeTracker with type for O(1) lookups
    this.nodeTracker.set(nodePath, object3D, node, node.type);

    // 3. Add to THREE.js parent
    if (parent) {
      parent.add(object3D);
    }

    // 4. Update TscnNode.children array
    if (parentPath) {
      const parentNode = this.nodeTracker.getNode(parentPath);
      if (parentNode) {
        if (!parentNode.children) {
          parentNode.children = [];
        }
        if (!parentNode.children.includes(node)) {
          parentNode.children.push(node);
        }
      }
    }

    // 5. Verify invariants (dev mode only)
    this.verifyInvariants(nodePath);

    // 6. Emit event for reactive UI updates
    this.emit({ type: 'nodeAdded', nodePath, node });
  }

  /**
   * Synchronize all three data structures when removing a node.
   * MUST be called when removing a node from the scene.
   *
   * This helper centralizes the three-way sync logic:
   * 1. Remove from parent TscnNode.children array
   * 2. Remove from THREE.js scene graph
   * 3. Remove from NodeTracker (including all descendants)
   *
   * Respects Invariant 5: Removal cascades to all descendants.
   */
  private syncNodeRemove(nodePath: string): void {
    const object = this.nodeTracker.getObject(nodePath);
    const node = this.nodeTracker.getNode(nodePath);

    if (!object) {
      logger.warn(`Node not found for removal: ${nodePath}`);
      return;
    }

    // 1. Remove from parent TscnNode's children array
    if (object.parent && node) {
      const parentPath = object.parent.userData.nodePath as string | undefined;
      if (parentPath) {
        const parentNode = this.nodeTracker.getNode(parentPath);
        if (parentNode?.children) {
          const index = parentNode.children.indexOf(node);
          if (index !== -1) {
            parentNode.children.splice(index, 1);
          }
        }
      }
    }

    // 2. Remove from THREE.js scene graph
    if (object.parent) {
      object.parent.remove(object);
    }

    // 3. Remove from NodeTracker (including all descendants)
    // Note: O(n) operation - could be optimized with parent→children map
    const pathsToRemove: string[] = [];
    for (const path of this.nodeTracker.getAllPaths()) {
      if (path === nodePath || path.startsWith(nodePath + '/')) {
        pathsToRemove.push(path);
      }
    }
    pathsToRemove.forEach(path => {
      this.nodeTracker.delete(path);
    });

    // 4. Emit event for reactive UI updates
    this.emit({ type: 'nodeRemoved', nodePath });
  }

  /**
   * Verify all invariants hold for a given node path (development mode only).
   * Throws if any invariant is violated.
   */
  private verifyInvariants(path: string): void {
    // Skip in production for performance
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    const object = this.nodeTracker.getObject(path);
    const node = this.nodeTracker.getNode(path);

    // Invariant 1 & 2: NodeTracker completeness and userData consistency
    if (!object || !node) {
      throw new Error(
        `Invariant violation: Incomplete tracking for ${path}. ` +
        `object=${!!object}, node=${!!node}`
      );
    }

    if (object.userData.nodePath !== path) {
      throw new Error(
        `Invariant violation: userData.nodePath mismatch for ${path}. ` +
        `Expected: ${path}, Got: ${object.userData.nodePath}`
      );
    }

    if (object.userData.nodeName !== node.name) {
      throw new Error(
        `Invariant violation: userData.nodeName mismatch for ${path}. ` +
        `Expected: ${node.name}, Got: ${object.userData.nodeName}`
      );
    }

    // Invariant 3: Parent-child relationship consistency
    if (object.parent && object.parent !== this.scene) {
      const parentPath = object.parent.userData.nodePath as string | undefined;

      if (!parentPath) {
        throw new Error(
          `Invariant violation: Parent object missing nodePath for ${path}`
        );
      }

      const parentNode = this.nodeTracker.getNode(parentPath);
      if (!parentNode) {
        throw new Error(
          `Invariant violation: Parent node not in tracker for ${path}. ` +
          `Parent path: ${parentPath}`
        );
      }

      if (!parentNode.children || !parentNode.children.includes(node)) {
        throw new Error(
          `Invariant violation: Node ${path} not in parent.children array. ` +
          `Parent: ${parentPath}, Parent has ${parentNode.children?.length || 0} children`
        );
      }

      const parentObject = this.nodeTracker.getObject(parentPath);
      if (object.parent !== parentObject) {
        throw new Error(
          `Invariant violation: THREE.js parent mismatch for ${path}. ` +
          `Parent path: ${parentPath}`
        );
      }
    }
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

    // Render node (may be async for resource loading)
    const object3D = await renderNodeWithRegistry(node, sceneData);
    if (!object3D) {
      logger.warn(`Failed to render node: ${node.name} (type: ${node.type})`);
      return;
    }

    // Synchronize all three data structures
    this.syncNodeAdd(nodePath, node, object3D, parent, parentPath);

    // Handle external scene instance (delegate to SceneManager)
    if (node.instance) {
      if (!this.sceneManager) {
        logger.warn(`SceneManager not set, cannot load instance: ${nodePath}`);
        return;
      }

      logger.info(`Node ${nodePath} has instance attribute: ${node.instance}`);

      // Resolve instance path via ResourceRegistry
      const scenePath = sceneData.resourceRegistry?.resolveInstancePath(node.instance);
      if (!scenePath) {
        // Error already logged by resolveInstancePath()
        return;
      }

      // Check if this is a GLB/GLTF file (binary scene format)
      // GLB/GLTF files should NOT go through SceneManager (expects text TSCN)
      const ext = scenePath.split('.').pop()?.toLowerCase();
      if (ext === 'glb' || ext === 'gltf') {
        logger.info(`Node ${nodePath} instances GLB/GLTF file: ${scenePath}`);

        // GLB/GLTF instancing via ResourceRegistry
        let glbScene: THREE.Object3D | null = null;
        if (sceneData.resourceRegistry) {
          try {
            // Parse reference to extract resource ID (e.g., "ExtResource("1_abc")" -> "1_abc")
            const resourceId = ResourceRegistry.parseReference(node.instance);
            if (!resourceId) {
              logger.warn(`Failed to parse GLB instance reference: ${node.instance}`);
            } else {
              glbScene = await sceneData.resourceRegistry.loadGLBMesh(resourceId);
              if (glbScene) {
                // Add GLB scene graph as child of instance node
                glbScene.name = `${node.name}_glb`;
                object3D.add(glbScene);
                logger.info(`Successfully loaded GLB instance: ${scenePath}`);
              } else {
                logger.warn(`Failed to load GLB instance: ${scenePath}`);
              }
            }
          } catch (error) {
            logger.warn(`Error loading GLB instance ${scenePath}:`, error);
          }
        }

        // Process inline children (children defined in parent scene)
        // These can be either:
        // 1. New children being added to the GLB instance (no index attribute)
        // 2. Overrides for existing children inside the GLB (has index attribute)
        if (node.children && node.children.length > 0) {
          for (const child of node.children) {
            // Check if this child has an index attribute (Godot's editable instance feature)
            const childProps = child.properties as { index?: number; transform?: unknown };

            if (childProps.index !== undefined && glbScene) {
              // This is an override for an existing child in the GLB scene graph
              // Find the child at the specified index
              const glbChild = glbScene.children[childProps.index];

              if (glbChild) {
                logger.info(`Applying editable instance override for child ${childProps.index} (${child.name})`);

                // Apply transform override if specified
                if (childProps.transform) {
                  const transform3D = childProps.transform as {
                    basis_x: { x: number; y: number; z: number };
                    basis_y: { x: number; y: number; z: number };
                    basis_z: { x: number; y: number; z: number };
                    origin: { x: number; y: number; z: number };
                  };

                  // Build a three.js Matrix4 from the Godot Transform3D
                  // Godot uses column-major order, three.js uses row-major in the constructor
                  glbChild.matrix.set(
                    transform3D.basis_x.x, transform3D.basis_y.x, transform3D.basis_z.x, transform3D.origin.x,
                    transform3D.basis_x.y, transform3D.basis_y.y, transform3D.basis_z.y, transform3D.origin.y,
                    transform3D.basis_x.z, transform3D.basis_y.z, transform3D.basis_z.z, transform3D.origin.z,
                    0, 0, 0, 1
                  );
                  glbChild.matrixAutoUpdate = false;

                  logger.info(`Applied transform override to ${child.name}`);
                }

                // TODO: Apply material overrides (surface_material_override/N)
                // TODO: Apply other property overrides as needed
              } else {
                logger.warn(`Child index ${childProps.index} out of bounds in GLB (has ${glbScene.children.length} children)`);
              }
            } else {
              // No index attribute - this is a new child being added
              const childPath = joinPath(nodePath, child.name);
              await this.addNode(childPath, child, sceneData, nodePath);
            }
          }
        }

        return;
      }

      // TSCN scene instancing via SceneManager
      // Set instance metadata for UI layer
      node.instanceMetadata = {
        sourcePath: scenePath,
        isInstanceRoot: true
      };

      // Capture original children BEFORE SceneManager adds external scene nodes
      // This handles the case where an instance node has additional children defined in the parent scene
      const originalChildren = node.children ? [...node.children] : [];

      // Delegate to SceneManager (will modify node.children by adding external scene nodes)
      await this.sceneManager.addScene(nodePath, scenePath);
      // Note: Success/failure is logged by SceneManager.addScene()

      // Process ONLY the original children (not the external scene nodes added by SceneManager)
      // This allows instance nodes to have additional children in the parent scene
      for (const child of originalChildren) {
        const childPath = joinPath(nodePath, child.name);
        await this.addNode(childPath, child, sceneData, nodePath);
      }

      return;
    }

    // Recursively add children (only for non-instance nodes)
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
    // Synchronize all three data structures
    this.syncNodeRemove(nodePath);
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

    // Emit update event for semantic clarity
    this.emit({ type: 'nodeUpdated', nodePath, node });
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
