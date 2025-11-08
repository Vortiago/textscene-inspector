/**
 * Manages visual helpers for node highlighting and hover effects.
 */

import * as THREE from 'three';
import { NodeTracker } from './NodeTracker';
import * as logger from '../logger';

interface ColoredHelperState {
  object: THREE.Object3D;
  originalColor: number;
}

export class HelperManager {
  private helpers: Map<string, THREE.BoxHelper> = new Map();
  private coloredHelpers: Map<string, ColoredHelperState> = new Map();
  private scene: THREE.Scene;
  private nodeTracker: NodeTracker;

  constructor(scene: THREE.Scene, nodeTracker: NodeTracker) {
    this.scene = scene;
    this.nodeTracker = nodeTracker;
  }

  /**
   * Set a helper (highlight or hover) for a node
   *
   * Nodes can customize highlighting via userData:
   * - `userData.getHighlightTarget()` - Returns the object to highlight (default: the node itself)
   *
   * If a custom target is provided AND it has a material.color property, we change the color directly.
   * Otherwise, we create a BoxHelper around the target.
   */
  private setHelper(key: string, nodePath: string, color: number): void {
    // Clear existing helper with this key
    this.clearHelper(key);

    const object = this.nodeTracker.getObject(nodePath);
    if (!object) {
      logger.warn(`Cannot set helper: node not found at path ${nodePath}`);
      return;
    }

    // Check if node provides a custom highlight target via userData callback
    const customTarget = object.userData.getHighlightTarget?.();
    const targetObject = customTarget || object;

    // If a CUSTOM target is provided and it has a material with color, use color-based highlighting
    // This avoids changing scene geometry colors (which have material.color but shouldn't be highlighted that way)
    if (customTarget && this.hasMaterialWithColor(targetObject)) {
      const material = (targetObject as THREE.Mesh).material as THREE.Material & { color: THREE.Color };
      const originalColor = material.color.getHex();
      this.coloredHelpers.set(key, { object: targetObject, originalColor });
      material.color.setHex(color);
      return;
    }

    // Otherwise, create a BoxHelper around the target
    const helper = new THREE.BoxHelper(targetObject, color);
    this.scene.add(helper);
    this.helpers.set(key, helper);
  }

  /**
   * Clear a specific helper by key
   */
  private clearHelper(key: string): void {
    // Check if this is a colored helper (object with changed material color)
    const coloredHelper = this.coloredHelpers.get(key);
    if (coloredHelper && this.hasMaterialWithColor(coloredHelper.object)) {
      const material = (coloredHelper.object as THREE.Mesh).material as THREE.Material & { color: THREE.Color };
      material.color.setHex(coloredHelper.originalColor);
      this.coloredHelpers.delete(key);
      return;
    }

    // Otherwise, handle box helper
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
    // Restore colored helper colors
    this.coloredHelpers.forEach(state => {
      if (this.hasMaterialWithColor(state.object)) {
        const material = (state.object as THREE.Mesh).material as THREE.Material & { color: THREE.Color };
        material.color.setHex(state.originalColor);
      }
    });
    this.coloredHelpers.clear();

    // Remove box helpers
    this.helpers.forEach(helper => {
      this.scene.remove(helper);
      helper.dispose();
    });
    this.helpers.clear();
  }

  /**
   * Type guard to check if an object has a material with a color property
   */
  private hasMaterialWithColor(object: THREE.Object3D): boolean {
    const mesh = object as THREE.Mesh;
    if (!mesh.material) return false;
    const material = mesh.material as THREE.Material & { color?: THREE.Color };
    return material.color instanceof THREE.Color;
  }

  /**
   * Highlight a node (green box for most nodes, or color change if material supports it)
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
   * Show hover effect (orange box for most nodes, or color change if material supports it)
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
