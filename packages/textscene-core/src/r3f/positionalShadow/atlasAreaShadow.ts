/**
 * An AreaLight3D's shadow as Godot 4.7.2 keeps it: one paraboloid facing the light's -Z, drawn
 * straight into one slot of the positional shadow atlas (`render_forward_clustered.cpp:2755-2768`).
 * three never draws it. The shadow pass's area step does (`areaShadowPass.ts`).
 * `positionalShadow.md` beside this file has the design.
 */

import * as THREE from 'three';
import {
  areaLightBounds,
  areaLightShadowCoverageRadius,
  areaLightShadowDepthScale,
  areaLightShadowFar,
  type AreaLightBox,
} from '../../godot/rendering/lights/areaLightShadow.js';
import type { PositionalShadowSlot } from '../../godot/rendering/lights/positionalShadowAtlas.js';
import { confineShadowScissor, type LightShadowInternals } from '../sharedAtlasShadow.js';
import { lightPoseMatrix, readLightPose } from './lightPose.js';
import { drawIntoAtlasSlot, positionalShadowAtlas } from './shadowAtlasTarget.js';
import { readIntensityThroughSlot, type SlottedShadow } from './slotOpacity.js';

/**
 * The camera the paraboloid renders through: the light's pose, and a projection that maps the
 * distance the vertex stage writes into z, from the light to `far`, onto the clip range. Godot
 * writes `distance / z_far * 2 - 1` and renders through an identity projection
 * (`scene_forward_clustered.glsl:503-518`, `renderer_scene_cull.cpp:2661`).
 */
export class ParaboloidCamera extends THREE.Camera {
  far = 1;

  updateProjectionMatrix(): void {
    this.projectionMatrix.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 2 / this.far, -1, 0, 0, 0, 1);
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  }
}

const casterBox = new THREE.Box3();

/**
 * The casters the paraboloid renders: those whose world box meets the light's volume, as Godot culls
 * an instance's AABB against the volume's planes (`renderer_scene_cull.cpp:2599-2662`,
 * `dynamic_bvh.h:137-177`). three's own test takes the bounding sphere, which reaches past a corner.
 */
export class AreaShadowVolume extends THREE.Frustum {
  /** Sets the planes to the faces of `box`, a box in the space of `pose`. */
  enclose(box: AreaLightBox, pose: THREE.Matrix4): void {
    for (let axis = 0; axis < 3; axis++) {
      const [lower, upper] = [this.planes[axis * 2]!, this.planes[axis * 2 + 1]!];
      lower.normal.set(0, 0, 0).setComponent(axis, 1);
      lower.constant = -box.min[axis]!;
      upper.normal.set(0, 0, 0).setComponent(axis, -1);
      upper.constant = box.max[axis]!;
    }
    for (const plane of this.planes) plane.applyMatrix4(pose);
  }

  override intersectsObject(object: THREE.Object3D): boolean {
    casterBox.copy(localBox(object)).applyMatrix4(object.matrixWorld);
    return this.intersectsBox(casterBox);
  }
}

/** The object's own box: an instanced or skinned mesh keeps one, any other mesh its geometry's. */
function localBox(object: THREE.Object3D): THREE.Box3 {
  const boxed = object as THREE.Object3D & {
    boundingBox?: THREE.Box3 | null;
    computeBoundingBox?: () => void;
    geometry: THREE.BufferGeometry;
  };
  if (boxed.boundingBox !== undefined) {
    if (boxed.boundingBox === null) boxed.computeBoundingBox!();
    return boxed.boundingBox!;
  }
  if (boxed.geometry.boundingBox === null) boxed.geometry.computeBoundingBox();
  return boxed.geometry.boundingBox!;
}

type AreaShadowInternals = THREE.LightShadow<ParaboloidCamera> & LightShadowInternals;
const AreaShadowBase = THREE.LightShadow as unknown as new (camera: ParaboloidCamera) => AreaShadowInternals;

export class AtlasAreaShadow extends AreaShadowBase implements SlottedShadow {
  /** The light's slot in the atlas of the viewport that renders now, or null for none. */
  slot: PositionalShadowSlot | null = null;
  opacity = 1;
  /** `area_range`. */
  range = 0;
  /** `area_size`. */
  readonly size = new THREE.Vector2();
  /** The slot's rectangle in units of the slot, as three gives a viewport (`WebGLShadowMap.js:345-350`). */
  private readonly slotRect = new THREE.Vector4(0, 0, 1, 1);

  constructor() {
    super(new ParaboloidCamera());
    this.autoUpdate = false;
    this.map = positionalShadowAtlas();
    this._frustum = new AreaShadowVolume();
  }

  /** Draws into `slot` of the atlas from the next shadow pass on, or into nothing for null. */
  place(slot: PositionalShadowSlot | null): void {
    this.slot = slot;
    if (slot === null) return;
    drawIntoAtlasSlot(this, slot, this.slotRect);
  }

  /**
   * three calls this before it binds and clears the atlas (`WebGLShadowMap.js:291`). The camera takes
   * the light's pose, the clear stays in the slot, and the casters are those in the light's volume.
   */
  override updateMatrices(light: THREE.Object3D): void {
    this.fitCamera(light);
    (this._frustum as AreaShadowVolume).enclose(this.bounds(), this.camera.matrixWorld);
    confineShadowScissor(this, this.slotRect);
  }

  /**
   * Writes the matrix from the space of `view` into the light's own, which Godot's lookup reads as
   * `shadow_matrix` (4.7.2 `light_storage.cpp:1196-1198`). It takes the pose the map renders from.
   */
  viewToLight(light: THREE.Object3D, view: THREE.Camera, target: THREE.Matrix4): THREE.Matrix4 {
    return lightPoseMatrix(light, target).invert().multiply(view.matrixWorld);
  }

  /** Writes the slot as `atlas_rect`: its corner and side in units of the atlas, or zero without one. */
  slotUvRect(target: THREE.Vector4): THREE.Vector4 {
    if (this.slot === null) return target.set(0, 0, 0, 0);
    const atlasSize = positionalShadowAtlas().width;
    const { x, y, size } = this.slot;
    return target.set(x, y, size, size).divideScalar(atlasSize);
  }

  /** Lets go of the atlas, which other shadows share. */
  override dispose(): void {
    this.map = null;
  }

  /** The light's volume in its own space, which holds every caster the paraboloid renders. */
  bounds(): AreaLightBox {
    return areaLightBounds(this.range, this.size);
  }

  /** The distance the atlas projects onto the screen to choose the slot. */
  coverageRadius(): number {
    return areaLightShadowCoverageRadius(this.range, this.size);
  }

  /** The lookup's scale from a distance to the light to the depth the map holds. */
  depthScale(): number {
    return areaLightShadowDepthScale(this.range, this.size);
  }

  /** Puts the camera at the light's pose, with the far plane its range and size reach. */
  private fitCamera(light: THREE.Object3D): void {
    readLightPose(light, this.camera.position, this.camera.quaternion);
    this.camera.updateMatrixWorld();
    this.camera.far = areaLightShadowFar(this.range, this.size);
    this.camera.updateProjectionMatrix();
  }
}

readIntensityThroughSlot(AtlasAreaShadow);

/** A rect area light that casts its shadow through the atlas. */
export type AreaShadowLight = THREE.RectAreaLight & { shadow: AtlasAreaShadow };

export function isAreaShadowLight(light: THREE.Light): light is AreaShadowLight {
  return (light as { shadow?: unknown }).shadow instanceof AtlasAreaShadow;
}
