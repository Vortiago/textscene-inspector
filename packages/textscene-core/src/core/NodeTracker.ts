/**
 * Tracks node mappings between TSCN data and Three.js objects.
 * Ensures nodePathMap and tscnNodeMap stay synchronized.
 */

import * as THREE from 'three';
import type { TscnNode } from '../parser/types';

export class NodeTracker {
  private nodePathMap: Map<string, THREE.Object3D> = new Map();
  private tscnNodeMap: Map<string, TscnNode> = new Map();
  private nodesByType: Map<string, Set<string>> = new Map();
  private nodeTypes: Map<string, string> = new Map();

  /**
   * Add a node to both maps atomically
   * @param nodePath - The full path of the node
   * @param object3D - The THREE.js object
   * @param tscnNode - The TSCN node data
   * @param type - Optional node type for fast type-based lookups (e.g., 'MeshInstance3D')
   */
  set(nodePath: string, object3D: THREE.Object3D, tscnNode: TscnNode, type?: string): void {
    this.nodePathMap.set(nodePath, object3D);
    this.tscnNodeMap.set(nodePath, tscnNode);

    // Index by type for O(1) lookups
    if (type) {
      if (!this.nodesByType.has(type)) {
        this.nodesByType.set(type, new Set());
      }
      this.nodesByType.get(type)!.add(nodePath);
      this.nodeTypes.set(nodePath, type);
    }
  }

  /**
   * Remove a node from both maps atomically
   */
  delete(nodePath: string): void {
    // Clean up type index
    const type = this.nodeTypes.get(nodePath);
    if (type) {
      const pathsOfType = this.nodesByType.get(type);
      if (pathsOfType) {
        pathsOfType.delete(nodePath);
        // Clean up empty sets to avoid memory leaks
        if (pathsOfType.size === 0) {
          this.nodesByType.delete(type);
        }
      }
      this.nodeTypes.delete(nodePath);
    }

    this.nodePathMap.delete(nodePath);
    this.tscnNodeMap.delete(nodePath);
  }

  /**
   * Get Three.js object by node path
   */
  getObject(nodePath: string): THREE.Object3D | undefined {
    return this.nodePathMap.get(nodePath);
  }

  /**
   * Get TSCN node data by path
   */
  getNode(nodePath: string): TscnNode | undefined {
    return this.tscnNodeMap.get(nodePath);
  }

  /**
   * Check if path exists
   */
  has(nodePath: string): boolean {
    return this.nodePathMap.has(nodePath);
  }

  /**
   * Get all tracked paths
   */
  getAllPaths(): string[] {
    return Array.from(this.nodePathMap.keys());
  }

  /**
   * Get all node paths of a specific type (O(1) lookup)
   * @param type - The node type (e.g., 'MeshInstance3D', 'Camera3D')
   * @returns Set of node paths of that type
   */
  getNodesByType(type: string): Set<string> {
    return this.nodesByType.get(type) || new Set();
  }

  /**
   * Clear all tracked nodes
   */
  clear(): void {
    this.nodePathMap.clear();
    this.tscnNodeMap.clear();
    this.nodesByType.clear();
    this.nodeTypes.clear();
  }

  /**
   * Get count of tracked nodes
   */
  get size(): number {
    return this.nodePathMap.size;
  }
}
