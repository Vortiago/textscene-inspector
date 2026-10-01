/**
 * The shadow of a directional light that draws Godot's parallel splits: one atlas, laid out as
 * Godot lays out its directional atlas, with one orthographic camera per split. three's WebGL
 * renderer draws and samples it through its sun-light path: `WebGLShadowMap.js:287-358` renders
 * one viewport per slot, and `WebGLLights.js:289-327` uploads one matrix and one vec4 per slot.
 */

import * as THREE from 'three';
import {
  DIRECTIONAL_SHADOW_MAX_SPLITS,
  directionalShadowSplitAtlasRect,
} from '../../godot/directionalShadow.js';

/**
 * Every shadow on the sun path holds this many slots, because the shader finds a light's slots at
 * `shadowIndex * SUN_LIGHT_CASCADES` (`splitShadowChunk.ts`). A light with fewer splits leaves the
 * slots past its last split undrawn.
 */
export const SPLIT_SLOTS = DIRECTIONAL_SHADOW_MAX_SPLITS;

/** The `up` of every split camera, which three's `lookAt` rolls the split boxes by. */
export const SPLIT_CAMERA_UP: Readonly<THREE.Vector3> = new THREE.Vector3(0, 1, 0);

/** A frustum that holds nothing, so the shadow pass draws no caster into an undrawn slot. */
function emptyFrustum(): THREE.Frustum {
  const nowhere = () => new THREE.Plane(new THREE.Vector3(1, 0, 0), -Infinity);
  return new THREE.Frustum(nowhere(), nowhere(), nowhere(), nowhere(), nowhere(), nowhere());
}

export class DirectionalSplitShadow extends THREE.LightShadow<THREE.OrthographicCamera> {
  readonly isDirectionalSplitShadow = true;

  /** How many slots draw a split: 2 or 4. */
  splitCount = SPLIT_SLOTS;

  /**
   * One vec4 per slot, read by name into `sunShadowCascade` (`WebGLLights.js:315`). The fitter
   * writes them, in the layout `fitDirectionalShadowSplits.ts` documents, before the shadow's
   * first render.
   */
  readonly _cascadeData: THREE.Vector4[] = [];

  /** One camera per slot. The fitter places each drawn one before every render. */
  private readonly splitCameras: THREE.OrthographicCamera[] = [];
  private readonly splitMatrices: THREE.Matrix4[] = [];
  private readonly splitFrustums: THREE.Frustum[] = [];
  private readonly splitViewports: THREE.Vector4[] = [];
  private readonly atlasExtents = new THREE.Vector2(1, 1);
  private readonly undrawn = emptyFrustum();
  private readonly projectionView = new THREE.Matrix4();

  constructor() {
    super(new THREE.OrthographicCamera());
    for (let slot = 0; slot < SPLIT_SLOTS; slot++) {
      const camera = new THREE.OrthographicCamera();
      camera.up.copy(SPLIT_CAMERA_UP);
      this.splitCameras.push(camera);
      this.splitMatrices.push(new THREE.Matrix4());
      this.splitFrustums.push(new THREE.Frustum());
      this.splitViewports.push(new THREE.Vector4());
      this._cascadeData.push(new THREE.Vector4(0, 0, 0, 0));
    }
  }

  /**
   * Lays out an `atlasSize` atlas for `splitCount` splits. `mapSize` is one split's rectangle, and
   * three multiplies it by the frame extents to size the atlas (`WebGLShadowMap.js:170-176`).
   */
  setSplits(splitCount: number, atlasSize: number): void {
    this.splitCount = splitCount;
    const first = directionalShadowSplitAtlasRect(splitCount, 0, atlasSize);
    this.mapSize.set(first.width, first.height);
    this.atlasExtents.set(atlasSize / first.width, atlasSize / first.height);
    for (let slot = 0; slot < SPLIT_SLOTS; slot++) {
      const viewport = this.splitViewports[slot]!;
      if (slot >= splitCount) {
        viewport.set(0, 0, 0, 0);
        continue;
      }
      const rect = directionalShadowSplitAtlasRect(splitCount, slot, atlasSize);
      viewport.set(rect.x / first.width, rect.y / first.height, 1, 1);
    }
  }

  override getViewportCount(): number {
    return SPLIT_SLOTS;
  }

  override getViewport(slot: number): THREE.Vector4 {
    return this.splitViewports[slot]!;
  }

  override getFrameExtents(): THREE.Vector2 {
    return this.atlasExtents;
  }

  override getCamera(slot = 0): THREE.OrthographicCamera {
    return this.splitCameras[slot]!;
  }

  override getFrustum(slot = 0): THREE.Frustum {
    return slot < this.splitCount ? this.splitFrustums[slot]! : this.undrawn;
  }

  /** The world-to-atlas matrix of `slot`, read by `WebGLLights.js:314`. */
  getMatrix(slot = 0): THREE.Matrix4 {
    return this.splitMatrices[slot]!;
  }

  /**
   * three calls this before it draws the atlas (`WebGLShadowMap.js:291`). The cameras are already
   * placed, so only their matrices follow. An undrawn slot repeats the last split's matrix, as its
   * vec4 repeats that split's far end. With no split drawn, every slot keeps its matrix.
   */
  override updateMatrices(_light: THREE.Light): void {
    const lastSplit = Math.max(this.splitCount - 1, 0);
    for (let slot = 0; slot < SPLIT_SLOTS; slot++) {
      if (slot < this.splitCount) this.updateSplitMatrix(slot);
      else this.splitMatrices[slot]!.copy(this.splitMatrices[lastSplit]!);
    }
  }

  /** `LightShadow._updateMatrix` for one slot, with the slot's rectangle of the atlas. */
  private updateSplitMatrix(slot: number): void {
    const camera = this.splitCameras[slot]!;
    this.followDepthConvention(camera);
    this.projectionView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.splitFrustums[slot]!.setFromProjectionMatrix(
      this.projectionView,
      camera.coordinateSystem,
      camera.reversedDepth
    );
    const viewport = this.splitViewports[slot]!;
    const scaleX = viewport.z / this.atlasExtents.x;
    const scaleY = viewport.w / this.atlasExtents.y;
    const offsetX = viewport.x / this.atlasExtents.x;
    const offsetY = viewport.y / this.atlasExtents.y;
    const depthIsUnit =
      camera.coordinateSystem === THREE.WebGPUCoordinateSystem || camera.reversedDepth;
    this.splitMatrices[slot]!.set(
      0.5 * scaleX, 0, 0, 0.5 * scaleX + offsetX,
      0, 0.5 * scaleY, 0, 0.5 * scaleY + offsetY,
      0, 0, depthIsUnit ? 1 : 0.5, depthIsUnit ? 0 : 0.5,
      0, 0, 0, 1
    ).multiply(this.projectionView);
  }

  /**
   * three sets the depth convention on the light's own camera (`WebGLShadowMap.js:201`), after the
   * fit built the slot's projection, so a slot whose convention changes rebuilds its projection.
   */
  private followDepthConvention(camera: THREE.OrthographicCamera): void {
    const reversedDepth = this.camera.reversedDepth;
    if (camera.reversedDepth === reversedDepth) return;
    (camera as unknown as { _reversedDepth: boolean })._reversedDepth = reversedDepth;
    camera.updateProjectionMatrix();
  }
}
