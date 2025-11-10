/**
 * Renders parsed TSCN scenes using three.js.
 * Orchestrates specialized managers for different concerns.
 */

import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { TscnScene, MissingResource, ResourceNeededCallback } from '../parser/types';
import type { ResourceProvider } from '../resources/ResourceProvider';
import { setupThreeJsScene } from './SceneSetup';
import { NodeTracker } from './NodeTracker';
import { HelperManager } from './HelperManager';
import { SelectionManager } from './SelectionManager';
import { ResourceRecoveryManager } from './ResourceRecoveryManager';
import { CameraManager } from './CameraManager';
import { ResourceRegistry } from '../resources/ResourceRegistry';
import { SceneManager } from './SceneManager';
import { NodeLifecycleManager } from './NodeLifecycleManager';
import { TscnParser } from '../parser/TscnParser';
import * as logger from '../logger';
import { getEnvironmentSettings } from '../nodes/3d/worldenvironment/renderer.js';
import { BackgroundMode } from '../resources/environment/types.js';

export interface CameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

export interface TscnRendererOptions {
  onResourceNeeded?: ResourceNeededCallback;
  resourceProvider?: ResourceProvider;
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
  private cameraManager: CameraManager;
  private resourceRegistry: ResourceRegistry;
  private sceneManager: SceneManager;
  private nodeLifecycle: NodeLifecycleManager;

  // State
  private currentSceneData: TscnScene | null = null;
  private renderInProgress: Promise<void> | null = null;
  private _options: TscnRendererOptions;

  constructor(canvas: HTMLCanvasElement, options: TscnRendererOptions = {}) {
    logger.info('Initializing TscnRenderer');
    this._options = options;

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
    this.cameraManager = new CameraManager(this.nodeTracker, this.camera, this.controls);

    // Initialize SceneManager with parser and tracker
    const parser = new TscnParser();
    this.sceneManager = new SceneManager(parser, this.nodeTracker);

    // Initialize NodeLifecycleManager (without SceneManager initially to break circular dependency)
    this.nodeLifecycle = new NodeLifecycleManager(this.scene, this.nodeTracker);

    // Wire up circular dependencies
    this.sceneManager.setNodeLifecycleManager(this.nodeLifecycle);
    this.nodeLifecycle.setSceneManager(this.sceneManager);

    // Initialize ResourceRecoveryManager (must be before wrapping onResourceNeeded)
    this.resourceRecovery = new ResourceRecoveryManager(
      this.nodeTracker,
      this.sceneManager,
      () => this.currentSceneData
    );

    // Initialize ResourceRegistry for external resource loading (textures, etc.)
    this.resourceRegistry = new ResourceRegistry();
    if (options.resourceProvider) {
      this.resourceRegistry.setProvider(options.resourceProvider);
    }

    // Wrap user's onResourceNeeded callback to also track missing resources
    if (options.onResourceNeeded) {
      const userCallback = options.onResourceNeeded;
      const wrappedCallback = async (resource: any) => {
        // Track missing resource in ResourceRecoveryManager
        this.resourceRecovery.recordMissing(resource);
        // Call user's callback
        return await userCallback(resource);
      };

      // Set wrapped callback for both ResourceRegistry and SceneManager
      this.resourceRegistry.setOnResourceNeeded(wrappedCallback);
      this.sceneManager.setOnResourceNeeded(wrappedCallback);
    }
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

    // Attach ResourceRegistry to scene for external resource loading
    sceneData.resourceRegistry = this.resourceRegistry;

    // Register external resources with the ResourceRegistry
    for (const extRes of sceneData.externalResources) {
      this.resourceRegistry.register(extRes);
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

    // Apply WorldEnvironment settings to scene (background, fog, etc.)
    this.applyWorldEnvironment(sceneData);

    logger.info('Rendering complete');
  }

  /**
   * Apply WorldEnvironment settings to the THREE.js scene
   * Applies background color and fog if a WorldEnvironment node exists
   */
  private applyWorldEnvironment(_sceneData: TscnScene): void {
    // Search through all tracked nodes for WorldEnvironment
    // Note: We can't use node names from sceneData because child nodes are tracked by full path
    // (e.g., "Root/WorldEnvironment" not "WorldEnvironment")
    const allPaths = this.nodeTracker.getAllPaths();
    logger.info(`[WorldEnvironment] Searching ${allPaths.length} tracked nodes for WorldEnvironment`);

    let worldEnvGroup: THREE.Group | null = null;
    for (const path of allPaths) {
      const obj = this.nodeTracker.getObject(path);
      if (obj && obj.userData.nodeType === 'WorldEnvironment') {
        logger.info(`[WorldEnvironment] ✅ Found WorldEnvironment at path: ${path}`);
        worldEnvGroup = obj as THREE.Group;
        break;
      }
    }

    if (!worldEnvGroup) {
      logger.info('[WorldEnvironment] No WorldEnvironment node found in scene');
      // No WorldEnvironment node - use defaults
      return;
    }

    const envSettings = getEnvironmentSettings(worldEnvGroup);
    if (!envSettings) {
      logger.warn('WorldEnvironment node found but has no environment settings');
      return;
    }

    // Apply background color (BG_COLOR mode only)
    if (envSettings.background.mode === BackgroundMode.BG_COLOR) {
      const { r, g, b } = envSettings.background.color;
      const bgColor = new THREE.Color(r, g, b);
      this.scene.background = bgColor;
      logger.info(`Applied background color: rgb(${r.toFixed(2)}, ${g.toFixed(2)}, ${b.toFixed(2)})`);

      // Warn if energy multiplier is not default (1.0)
      if (Math.abs(envSettings.background.energyMultiplier - 1.0) > 0.001) {
        logger.warn(`Background energy multiplier (${envSettings.background.energyMultiplier}) is not supported - requires tone mapping/HDR pipeline (see WI-77)`);
      }
    } else if (envSettings.background.mode > BackgroundMode.BG_COLOR) {
      logger.warn(`Background mode ${envSettings.background.mode} not yet supported (only BG_CLEAR_COLOR=0 and BG_COLOR=1 are implemented)`);
    }

    // Apply volumetric fog if enabled
    if (envSettings.fog && envSettings.fog.enabled) {
      const { r, g, b } = envSettings.fog.albedo;
      const fogColor = new THREE.Color(r, g, b);
      // Use THREE.FogExp2 for exponential fog density
      // Pass the Color instance directly (not getHex()) to ensure proper color handling
      this.scene.fog = new THREE.FogExp2(fogColor, envSettings.fog.density);
      logger.info(`Applied volumetric fog: density=${envSettings.fog.density.toFixed(4)}, albedo=rgb(${r.toFixed(2)}, ${g.toFixed(2)}, ${b.toFixed(2)})`);

      // Log info if emission is non-zero (visual-only feature not fully supported)
      const emission = envSettings.fog.emission;
      if (emission.r > 0 || emission.g > 0 || emission.b > 0) {
        logger.info(`Fog emission color detected (${emission.r}, ${emission.g}, ${emission.b}) - emission is visual-only and not fully supported in THREE.js`);
      }
    }

    // Warn about unsupported features
    if (envSettings.adjustments && envSettings.adjustments.enabled) {
      logger.warn('Color adjustments (brightness, contrast, saturation) are not yet supported - requires post-processing pipeline (see WI-77)');
    }

    if (envSettings.ssr && envSettings.ssr.enabled) {
      logger.warn('Screen-space reflections (SSR) are not yet supported - requires post-processing pipeline (see WI-77)');
    }
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

  /**
   * Add an event listener for node lifecycle events (add, remove, update)
   */
  addNodeLifecycleListener(listener: Parameters<NodeLifecycleManager['addEventListener']>[0]): void {
    return this.nodeLifecycle.addEventListener(listener);
  }

  /**
   * Remove an event listener for node lifecycle events
   */
  removeNodeLifecycleListener(listener: Parameters<NodeLifecycleManager['removeEventListener']>[0]): void {
    return this.nodeLifecycle.removeEventListener(listener);
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

  /**
   * Return to free view (default OrbitControls camera)
   * Shows all camera helpers and resets to default perspective camera
   */
  returnToFreeView(): void {
    return this.cameraManager.returnToFreeView();
  }

  /**
   * Get all Camera3D nodes in the scene
   */
  getSceneCameras(): Array<{ path: string; name: string; object: THREE.Object3D }> {
    return this.cameraManager.getSceneCameras();
  }

  /**
   * Switch to a Camera3D node by path
   * Updates the renderer's active camera and hides the helper for the active camera
   */
  switchToCamera(nodePath: string): boolean {
    return this.cameraManager.switchToCamera(nodePath);
  }

  /**
   * Set visibility of all camera helpers (frustum visualizations)
   * Useful for toggling camera visualization on/off
   */
  setCameraHelpersVisible(visible: boolean): void {
    return this.cameraManager.setCameraHelpersVisible(visible);
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

  /**
   * Get the THREE.js scene for testing purposes
   * @internal - For testing only
   */
  getSceneForTesting(): THREE.Scene {
    return this.scene;
  }

  dispose(): void {
    this.helperManager.clearAll();
    this.renderer.dispose();
  }
}
