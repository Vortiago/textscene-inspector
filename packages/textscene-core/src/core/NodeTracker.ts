/**
 * Tracks node mappings between TSCN data and Three.js objects.
 * Ensures nodePathMap and tscnNodeMap stay synchronized.
 */

import * as THREE from 'three';
import type { TscnNode } from '../parser/types';

export class NodeTracker {
  private nodePathMap: Map<string, THREE.Object3D> = new Map();
  private tscnNodeMap: Map<string, TscnNode> = new Map();

  /**
   * Add a node to both maps atomically
   */
  set(nodePath: string, object3D: THREE.Object3D, tscnNode: TscnNode): void {
    this.nodePathMap.set(nodePath, object3D);
    this.tscnNodeMap.set(nodePath, tscnNode);
  }

  /**
   * Remove a node from both maps atomically
   */
  delete(nodePath: string): void {
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
   * Clear all tracked nodes
   */
  clear(): void {
    this.nodePathMap.clear();
    this.tscnNodeMap.clear();
  }

  /**
   * Get count of tracked nodes
   */
  get size(): number {
    return this.nodePathMap.size;
  }
}
