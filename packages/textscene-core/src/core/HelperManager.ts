/**
 * Manages visual helpers for node highlighting and hover effects.
 */

import * as THREE from 'three';
import { NodeTracker } from './NodeTracker';
import * as logger from '../logger';

export class HelperManager {
  private helpers: Map<string, THREE.BoxHelper> = new Map();
  private scene: THREE.Scene;
  private nodeTracker: NodeTracker;

  constructor(scene: THREE.Scene, nodeTracker: NodeTracker) {
    this.scene = scene;
    this.nodeTracker = nodeTracker;
  }

  /**
   * Set a helper (highlight or hover) for a node
   */
  private setHelper(key: string, nodePath: string, color: number): void {
    // Clear existing helper with this key
    this.clearHelper(key);

    const object = this.nodeTracker.getObject(nodePath);
    if (!object) {
      logger.warn(`Cannot set helper: node not found at path ${nodePath}`);
      return;
    }

    // Create BoxHelper
    const helper = new THREE.BoxHelper(object, color);
    this.scene.add(helper);
    this.helpers.set(key, helper);
  }

  /**
   * Clear a specific helper by key
   */
  private clearHelper(key: string): void {
    const helper = this.helpers.get(key);
    if (helper) {
      this.scene.remove(helper);
      helper.dispose();
      this.helpers.delete(key);
    }
  }

  /**
   * Clear all helpers
   */
  clearAll(): void {
    this.helpers.forEach(helper => {
      this.scene.remove(helper);
      helper.dispose();
    });
    this.helpers.clear();
  }

  /**
   * Highlight a node with green box
   */
  highlightNode(nodePath: string): void {
    this.clearHelper('hover'); // Clear hover when highlighting
    this.setHelper('highlight', nodePath, 0x00ff00);
  }

  /**
   * Clear highlight
   */
  clearHighlight(): void {
    this.clearHelper('highlight');
  }

  /**
   * Show hover effect with orange box
   */
  showHoverEffect(nodePath: string): void {
    this.setHelper('hover', nodePath, 0xff8800);
  }

  /**
   * Clear hover effect
   */
  clearHoverEffect(): void {
    this.clearHelper('hover');
  }
}
