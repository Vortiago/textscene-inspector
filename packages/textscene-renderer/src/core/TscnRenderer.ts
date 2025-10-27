/**
 * Renders parsed TSCN scenes using three.js.
 */

import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { TscnScene, TscnNode } from '../parser/types';
import { renderNodeWithRegistry } from './NodeRegistry';
import { setupThreeJsScene } from './SceneSetup';
import * as logger from '../logger';

export interface CameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

export class TscnRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private nodePathMap: Map<string, THREE.Object3D> = new Map();
  private highlightHelper: THREE.BoxHelper | null = null;

  constructor(canvas: HTMLCanvasElement) {
    logger.info('Initializing TscnRenderer');
    const components = setupThreeJsScene(canvas);
    this.scene = components.scene;
    this.camera = components.camera;
    this.renderer = components.renderer;
    this.controls = components.controls;
  }

  render(sceneData: TscnScene): void {
    logger.info(`Rendering scene with ${sceneData.nodes.length} root nodes`);
    const objectsToRemove: THREE.Object3D[] = [];
    this.scene.children.forEach(child => {
      if (!(child instanceof THREE.Light) && !(child instanceof THREE.GridHelper)) {
        objectsToRemove.push(child);
      }
    });
    objectsToRemove.forEach(obj => this.scene.remove(obj));

    this.nodePathMap.clear();
    this.clearHighlight();

    // Use addNode for each root node to ensure consistent code path
    for (const node of sceneData.nodes) {
      this.addNode(node.name, node, sceneData);
    }
    logger.info('Rendering complete');
  }

  addNode(nodePath: string, node: TscnNode, sceneData: TscnScene, parentPath?: string): void {
    const parent = parentPath ? this.nodePathMap.get(parentPath) : this.scene;
    if (!parent) {
      logger.warn(`Parent not found for node: ${nodePath}`);
      return;
    }

    const object3D = renderNodeWithRegistry(node, sceneData);
    if (!object3D) {
      return;
    }

    object3D.userData.nodePath = nodePath;
    object3D.userData.nodeName = node.name;
    this.nodePathMap.set(nodePath, object3D);
    parent.add(object3D);

    // Recursively add children using addNode for consistency
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        const childPath = `${nodePath}/${child.name}`;
        this.addNode(childPath, child, sceneData, nodePath);
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

    // Clean up from map (including children)
    const pathsToRemove: string[] = [];
    this.nodePathMap.forEach((_, path) => {
      if (path === nodePath || path.startsWith(nodePath + '/')) {
        pathsToRemove.push(path);
      }
    });
    pathsToRemove.forEach(path => this.nodePathMap.delete(path));
  }

  updateNode(nodePath: string, node: TscnNode, sceneData: TscnScene): void {
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
    const pathParts = nodePath.split('/');
    pathParts.pop();
    const parentPath = pathParts.length > 0 ? pathParts.join('/') : undefined;

    this.removeNode(nodePath);
    this.addNode(nodePath, node, sceneData, parentPath);
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

  highlightNode(nodePath: string): void {
    this.clearHighlight();

    const object = this.nodePathMap.get(nodePath);
    if (!object) {
      logger.warn(`Node not found for highlighting: ${nodePath}`);
      return;
    }

    this.highlightHelper = new THREE.BoxHelper(object, 0x00ff00);
    this.scene.add(this.highlightHelper);
  }

  clearHighlight(): void {
    if (this.highlightHelper) {
      this.scene.remove(this.highlightHelper);
      this.highlightHelper.dispose();
      this.highlightHelper = null;
    }
  }

  dispose(): void {
    this.clearHighlight();
    this.renderer.dispose();
  }
}
