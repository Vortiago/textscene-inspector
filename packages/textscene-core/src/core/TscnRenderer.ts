/**
 * Renders parsed TSCN scenes using three.js.
 * Orchestrates specialized managers for different concerns.
 */

import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { TscnScene, MissingResource, ResourceNeededCallback } from '../parser/types';
import { setupThreeJsScene } from './SceneSetup';
import { NodeTracker } from './NodeTracker';
import { HelperManager } from './HelperManager';
import { SelectionManager } from './SelectionManager';
import { ResourceRecoveryManager } from './ResourceRecoveryManager';
import { SceneManager } from './SceneManager';
import { NodeLifecycleManager } from './NodeLifecycleManager';
import { TscnParser } from '../parser/TscnParser';
import * as logger from '../logger';

export interface CameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

export interface TscnRendererOptions {
  onResourceNeeded?: ResourceNeededCallback;
}

/**
 * Main renderer class - orchestrates specialized managers
 */
export class TscnRenderer {
  // Three.js core
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;

  // Specialized managers
  private nodeTracker: NodeTracker;
  private helperManager: HelperManager;
  private selectionManager: SelectionManager;
  private resourceRecovery: ResourceRecoveryManager;
  private sceneManager: SceneManager;
  private nodeLifecycle: NodeLifecycleManager;

  // State
  private currentSceneData: TscnScene | null = null;
  private renderInProgress: Promise<void> | null = null;
  private options: TscnRendererOptions;
  private missingResources: Map<string, MissingResource> = new Map();

  constructor(canvas: HTMLCanvasElement, options: TscnRendererOptions = {}) {
    logger.info('Initializing TscnRenderer');
    this.options = options;

    // Setup three.js
    const components = setupThreeJsScene(canvas);
    this.scene = components.scene;
    this.camera = components.camera;
    this.renderer = components.renderer;
    this.controls = components.controls;

    // Initialize managers
    this.nodeTracker = new NodeTracker();
    this.helperManager = new HelperManager(this.scene, this.nodeTracker);
    this.selectionManager = new SelectionManager(this.scene, this.camera, this.renderer, this.nodeTracker);

    // Initialize SceneManager with parser and tracker
    const parser = new TscnParser();
    this.sceneManager = new SceneManager(parser, this.nodeTracker);

    // Initialize NodeLifecycleManager (without SceneManager initially to break circular dependency)
    this.nodeLifecycle = new NodeLifecycleManager(this.scene, this.nodeTracker);

    // Wire up circular dependencies
    this.sceneManager.setNodeLifecycleManager(this.nodeLifecycle);
    this.nodeLifecycle.setSceneManager(this.sceneManager);

    this.resourceRecovery = new ResourceRecoveryManager(
      this.nodeTracker,
      this.sceneManager,
      () => this.currentSceneData
    );
  }

  /**
   * Render a TSCN scene
   */
  async render(sceneData: TscnScene): Promise<void> {
    // Wait for previous render to complete
    if (this.renderInProgress) {
      logger.info('Waiting for previous render to complete');
      await this.renderInProgress;
    }

    this.renderInProgress = this.performRender(sceneData);

    try {
      await this.renderInProgress;
    } finally {
      this.renderInProgress = null;
    }
  }

  /**
   * Perform the actual render
   */
  private async performRender(sceneData: TscnScene): Promise<void> {
    logger.info(`Rendering scene with ${sceneData.nodes.length} root nodes`);
    this.currentSceneData = sceneData;

    // Set ResourceRegistry on SceneManager for scene loading
    if (sceneData.resourceRegistry) {
      this.sceneManager.setResourceRegistry(sceneData.resourceRegistry);
    }

    // Clear scene (keep lights and grid)
    const objectsToRemove: THREE.Object3D[] = [];
    this.scene.children.forEach((child: THREE.Object3D) => {
      if (!(child instanceof THREE.Light) && !(child instanceof THREE.GridHelper)) {
        objectsToRemove.push(child);
      }
    });
    objectsToRemove.forEach(obj => this.scene.remove(obj));

    // Clear all state
    this.nodeTracker.clear();
    this.helperManager.clearAll();
    this.sceneManager.clear();
    this.resourceRecovery.clear();

    // Add all root nodes
    for (const node of sceneData.nodes) {
      await this.nodeLifecycle.addNode(node.name, node, sceneData);
    }

    logger.info('Rendering complete');
  }

  // ========== Node Lifecycle Delegation ==========

  async addNode(...args: Parameters<NodeLifecycleManager['addNode']>): Promise<void> {
    return this.nodeLifecycle.addNode(...args);
  }

  removeNode(nodePath: string): void {
    return this.nodeLifecycle.removeNode(nodePath);
  }

  async updateNode(...args: Parameters<NodeLifecycleManager['updateNode']>): Promise<void> {
    return this.nodeLifecycle.updateNode(...args);
  }

  setNodeVisibility(nodePath: string, visible: boolean): void {
    return this.nodeLifecycle.setNodeVisibility(nodePath, visible);
  }

  // ========== Selection Delegation ==========

  getNodePathAtScreenPosition(x: number, y: number): string | null {
    return this.selectionManager.getNodePathAtScreenPosition(x, y);
  }

  // ========== Helper Delegation ==========

  highlightNode(nodePath: string): void {
    return this.helperManager.highlightNode(nodePath);
  }

  clearHighlight(): void {
    return this.helperManager.clearHighlight();
  }

  showHoverEffect(nodePath: string): void {
    return this.helperManager.showHoverEffect(nodePath);
  }

  clearHoverEffect(): void {
    return this.helperManager.clearHoverEffect();
  }

  // ========== Resource Recovery Delegation ==========

  getMissingResources(): MissingResource[] {
    return this.resourceRecovery.getMissingResources();
  }

  async provideResource(path: string): Promise<void> {
    return this.resourceRecovery.provideResource(path);
  }

  // ========== Camera Management ==========

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

  resetCamera(): void {
    this.camera.position.set(10, 10, 10);
    this.camera.lookAt(0, 0, 0);
    this.controls.reset();
  }

  // ========== Animation & Rendering ==========

  startAnimationLoop(): void {
    const animate = (): void => {
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

  // ========== Scene Management API ==========

  /**
   * Hot-reload a scene file - updates all instances
   * Call this when a .tscn file changes on disk
   */
  async reloadScene(scenePath: string): Promise<void> {
    return this.sceneManager.updateScene(scenePath);
  }

  /**
   * Get all instance paths using a scene
   */
  getSceneInstances(scenePath: string): string[] {
    return this.sceneManager.getInstances(scenePath);
  }

  /**
   * Check if a scene is currently loaded (has instances)
   */
  hasScene(scenePath: string): boolean {
    return this.sceneManager.hasInstances(scenePath);
  }

  dispose(): void {
    this.helperManager.clearAll();
    this.renderer.dispose();
  }
}
