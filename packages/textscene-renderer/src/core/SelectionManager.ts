/**
 * Handles raycasting and node selection from screen coordinates.
 */

import * as THREE from 'three';
import { NodeTracker } from './NodeTracker';

export class SelectionManager {
  private raycaster: THREE.Raycaster;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private nodeTracker: NodeTracker;

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
    nodeTracker: NodeTracker
  ) {
    this.raycaster = new THREE.Raycaster();
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.nodeTracker = nodeTracker;
  }

  /**
   * Get node path at screen position (x, y in pixels)
   * Returns null if no mesh object found at that position
   */
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
        const object = this.nodeTracker.getObject(nodePath);
        if (object && this.isMeshObject(object)) {
          return nodePath;
        }
      }
    }

    return null;
  }

  /**
   * Find node path by traversing up the hierarchy
   */
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

  /**
   * Check if object is a mesh (selectable)
   */
  private isMeshObject(object: THREE.Object3D): boolean {
    if (object instanceof THREE.Mesh) {
      return true;
    }
    // Check children recursively
    return object.children.some(child => this.isMeshObject(child));
  }
}
