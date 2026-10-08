/**
 * The shadow of a directional light in Godot's shadow list, in one, two or four splits. It draws
 * into the light's share of Godot's directional atlas, laid out as Godot lays it out, with one
 * orthographic camera per split. `directionalShadow.md` beside this file has how three draws and
 * samples it.
 */

import * as THREE from 'three';
import {
  DIRECTIONAL_SHADOW_MAX_SPLITS,
  DIRECTIONAL_SHADOW_SIZE_DEFAULT,
  directionalShadowSplitAtlasRect,
  type DirectionalShadowAtlasRect,
} from '../../godot/directionalShadow.js';
import { confineShadowScissor, type LightShadowInternals } from '../sharedAtlasShadow.js';
import { holdDirectionalShadowAtlas, releaseDirectionalShadowAtlas } from './shadowAtlas.js';

/**
 * Every shadow on the sun path holds this many slots, because the shader finds a light's slots at
 * `shadowIndex * SUN_LIGHT_CASCADES` (`splitShadowChunk.ts`). A light with fewer splits leaves the
 * slots past its last split undrawn.
 */
export const SPLIT_SLOTS = DIRECTIONAL_SHADOW_MAX_SPLITS;

/** The `up` of every split camera, which three's `lookAt` rolls the split boxes by. */
export const SPLIT_CAMERA_UP: Readonly<THREE.Vector3> = new THREE.Vector3(0, 1, 0);

/** A plane that every point lies behind. */
const nowhere = () => new THREE.Plane(new THREE.Vector3(1, 0, 0), -Infinity);

/**
 * A frustum that holds nothing, so the shadow pass draws no caster into an undrawn slot. three
 * still walks the scene for the slot (`WebGLShadowMap.js:289-358`), so each caster's test answers
 * at once, without the bounding sphere `Frustum.intersectsObject` transforms.
 */
class UndrawnFrustum extends THREE.Frustum {
  constructor() {
    super(nowhere(), nowhere(), nowhere(), nowhere(), nowhere(), nowhere());
  }

  override intersectsObject(): boolean {
    return false;
  }
}

/** three's `LightShadow`, typed with the members its types leave out. */
const ThreeLightShadow = THREE.LightShadow as unknown as new (
  camera: THREE.OrthographicCamera
) => THREE.LightShadow<THREE.OrthographicCamera> & LightShadowInternals;

/** Scratch for `placeSplitFrusta`, which places one frustum at a time. */
const splitViewProjection = new THREE.Matrix4();

export class DirectionalSplitShadow extends ThreeLightShadow {
  /** How many slots draw a split: 1, 2 or 4. */
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
  private readonly undrawn = new UndrawnFrustum();

  /**
   * The light's share of the atlas, in units of one split's rectangle, as three gives each slot's
   * viewport (`WebGLShadowMap.js:345-350`).
   */
  private readonly share = new THREE.Vector4();

  /** The split count and light rectangle the layout was last built for. Written only by `layOut`. */
  private laidOutSplitCount = -1;
  private readonly laidOutRect: DirectionalShadowAtlasRect = { x: NaN, y: NaN, width: NaN, height: NaN };
  /** One split's rectangle in texels, as `layOut` last set `mapSize`. */
  private readonly splitSize = new THREE.Vector2();

  constructor() {
    super(new THREE.OrthographicCamera());
    this.map = holdDirectionalShadowAtlas(this);
    this._viewportCount = SPLIT_SLOTS;
    this._viewports = [];
    for (let slot = 0; slot < SPLIT_SLOTS; slot++) {
      const camera = new THREE.OrthographicCamera();
      camera.up.copy(SPLIT_CAMERA_UP);
      this.splitCameras.push(camera);
      this.splitMatrices.push(new THREE.Matrix4());
      this.splitFrustums.push(new THREE.Frustum());
      this._viewports.push(new THREE.Vector4());
      this._cascadeData.push(new THREE.Vector4(0, 0, 0, 0));
    }
  }

  /**
   * Lays out `splitCount` splits inside the light's rectangle of Godot's atlas. `mapSize` is one
   * split's rectangle. three multiplies it by the frame extents to size the atlas
   * (`WebGLShadowMap.js:170-176`), so every shadow asks for the same size and none resizes it
   * (`:281-285`). The fitter calls this on every render, so an unchanged layout is kept. three
   * shrinks `mapSize` on a GPU whose textures are smaller than the atlas (`:180-198`), so a kept
   * layout still writes it again.
   */
  setSplits(splitCount: number, lightRect: DirectionalShadowAtlasRect): void {
    this.splitCount = splitCount;
    if (this.isLaidOutFor(splitCount, lightRect)) this.mapSize.copy(this.splitSize);
    else this.layOut(splitCount, lightRect);
  }

  private isLaidOutFor(splitCount: number, lightRect: DirectionalShadowAtlasRect): boolean {
    const rect = this.laidOutRect;
    return (
      this.laidOutSplitCount === splitCount &&
      rect.x === lightRect.x &&
      rect.y === lightRect.y &&
      rect.width === lightRect.width &&
      rect.height === lightRect.height
    );
  }

  private layOut(splitCount: number, lightRect: DirectionalShadowAtlasRect): void {
    this.laidOutSplitCount = splitCount;
    this.laidOutRect.x = lightRect.x;
    this.laidOutRect.y = lightRect.y;
    this.laidOutRect.width = lightRect.width;
    this.laidOutRect.height = lightRect.height;
    const first = directionalShadowSplitAtlasRect(splitCount, 0, lightRect);
    this.mapSize.set(first.width, first.height);
    this.splitSize.copy(this.mapSize);
    this._frameExtents.set(
      DIRECTIONAL_SHADOW_SIZE_DEFAULT / first.width,
      DIRECTIONAL_SHADOW_SIZE_DEFAULT / first.height
    );
    this.share.set(
      lightRect.x / first.width,
      lightRect.y / first.height,
      lightRect.width / first.width,
      lightRect.height / first.height
    );
    for (let slot = 0; slot < SPLIT_SLOTS; slot++) {
      const viewport = this._viewports[slot]!;
      if (slot >= splitCount) {
        viewport.set(0, 0, 0, 0);
        continue;
      }
      const rect = directionalShadowSplitAtlasRect(splitCount, slot, lightRect);
      viewport.set(rect.x / first.width, rect.y / first.height, 1, 1);
    }
  }

  override getCamera(slot = 0): THREE.OrthographicCamera {
    return this.splitCameras[slot]!;
  }

  override getFrustum(slot = 0): THREE.Frustum {
    return slot < this.splitCount ? this.splitFrustums[slot]! : this.undrawn;
  }

  /**
   * Sets each drawn split's frustum from its camera, as the shadow pass will
   * (`LightShadow.js:237-238`). The fitter calls this once it places the cameras, so a cull that
   * runs before the shadow pass reads this render's splits.
   */
  placeSplitFrusta(): void {
    for (let slot = 0; slot < this.splitCount; slot++) {
      const camera = this.splitCameras[slot]!;
      splitViewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      this.splitFrustums[slot]!.setFromProjectionMatrix(
        splitViewProjection,
        camera.coordinateSystem,
        camera.reversedDepth
      );
    }
  }

  /** Whether a drawn split's frustum holds `box`. */
  holdsBox(box: THREE.Box3): boolean {
    for (let slot = 0; slot < this.splitCount; slot++) {
      if (this.splitFrustums[slot]!.intersectsBox(box)) return true;
    }
    return false;
  }

  /** The world-to-atlas matrix of `slot`, read by `WebGLLights.js:314`. */
  getMatrix(slot = 0): THREE.Matrix4 {
    return this.splitMatrices[slot]!;
  }

  /**
   * three calls this before it draws the light's share (`WebGLShadowMap.js:291`). The cameras are
   * already placed, so only their matrices follow. An undrawn slot repeats the last split's matrix,
   * as its vec4 repeats that split's far end. With no split drawn, every slot keeps its matrix.
   */
  override updateMatrices(_light: THREE.Light): void {
    // three clears the whole target before it draws a light (`WebGLShadowMap.js:338-339`), so the
    // scissor keeps the clear inside this light's share.
    confineShadowScissor(this, this.share);
    const lastSplit = Math.max(this.splitCount - 1, 0);
    for (let slot = 0; slot < SPLIT_SLOTS; slot++) {
      if (slot < this.splitCount) this.updateSplitMatrix(slot);
      else this.splitMatrices[slot]!.copy(this.splitMatrices[lastSplit]!);
    }
  }

  /** Lets go of the atlas. Other shadows share it, so it frees itself only once none holds it. */
  override dispose(): void {
    releaseDirectionalShadowAtlas(this);
    this.map = null;
  }

  /** three's own matrix and frustum update for one slot, with the slot's rectangle of the atlas. */
  private updateSplitMatrix(slot: number): void {
    const camera = this.splitCameras[slot]!;
    this.followDepthConvention(camera);
    this._updateMatrix(camera, this.splitMatrices[slot]!, this.splitFrustums[slot]!, this._viewports[slot]!);
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
