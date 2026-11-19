import * as THREE from 'three';
import { SKY_RENDER_ORDER } from '../../shaders/sky/skyRenderOrder.js';
import { observeSceneRenderEnd } from '../sceneRenderCamera.js';

/** A sky drawn at each pixel behind a scene, and hidden outside the renders that draw it. */
export abstract class SkyBackdrop extends THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  protected constructor(geometry: THREE.BufferGeometry, material: THREE.Material) {
    super(geometry, material);
    this.renderOrder = SKY_RENDER_ORDER;
    this.frustumCulled = false;
    this.matrixAutoUpdate = false;
    this.matrixWorldAutoUpdate = false;
    this.layers.enableAll();
    this.raycast = () => {};
    this.userData = { tscnFrameExcluded: true };
    this.visible = false;
  }

  /** Draws in this render unless the scene has a background. It stays a child, so trackers see it once. */
  drawIn(scene: THREE.Scene, intensity: number, rotation: THREE.Euler): void {
    if (scene.background !== null) return;
    this.paint(intensity, rotation);
    if (this.parent !== scene) scene.add(this);
    this.visible = true;
  }

  /** Writes the intensity and the rotation of the render now starting. */
  protected abstract paint(intensity: number, rotation: THREE.Euler): void;

  override dispose(): void {
    this.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    super.dispose();
  }
}

/** Lets a `SkyBackdrop` draw in each render. The disposer removes every sky and restores the background. */
export function showSkyBackground(scene: THREE.Scene): () => void {
  const previousBackground = scene.background;
  scene.background = null;
  const stopHiding = observeSceneRenderEnd(scene, () => hideSkyBackgrounds(scene));
  return () => {
    stopHiding();
    removeSkyBackgrounds(scene);
    scene.background = previousBackground;
  };
}

function hideSkyBackgrounds(scene: THREE.Scene): void {
  for (const child of scene.children) {
    if (child instanceof SkyBackdrop) child.visible = false;
  }
}

function removeSkyBackgrounds(scene: THREE.Scene): void {
  // Backwards, as each removal shifts the children after it.
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const child = scene.children[i]!;
    if (child instanceof SkyBackdrop) scene.remove(child);
  }
}
