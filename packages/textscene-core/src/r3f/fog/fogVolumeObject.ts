/**
 * A FogVolume node in the scene graph, which the volumetric fog finds and draws. It carries its
 * node's world transform, and the shape and fill the light pass reads.
 */

import * as THREE from 'three';
import {
  FOG_VOLUME_DEFAULT_SHAPE,
  FOG_VOLUME_DEFAULT_SIZE,
  type FogVolumeShape,
} from '../../godot/rendering/environment/fogVolume.js';
import type { FogMaterialData } from '../../resources/materials/fogmaterial/types.js';

/**
 * What fills a volume: Godot's default fog shader (`environment/fog.cpp:265-283`), which a volume
 * without a FogMaterial or a valid fog shader runs (`:672-683`), a FogMaterial with its density
 * texture once built, or a fog shader the previewer does not run.
 */
export type FogVolumeFill =
  | { kind: 'default' }
  | { kind: 'material'; material: FogMaterialData; densityTexture: THREE.Data3DTexture | null }
  | { kind: 'shader' };

export const DEFAULT_FOG_VOLUME_FILL: FogVolumeFill = { kind: 'default' };

export class FogVolumeObject extends THREE.Object3D {
  readonly isFogVolume = true;
  readonly size = new THREE.Vector3(
    FOG_VOLUME_DEFAULT_SIZE.x,
    FOG_VOLUME_DEFAULT_SIZE.y,
    FOG_VOLUME_DEFAULT_SIZE.z
  );
  shape: FogVolumeShape | number = FOG_VOLUME_DEFAULT_SHAPE;
  fill: FogVolumeFill = DEFAULT_FOG_VOLUME_FILL;
}

export function isFogVolume(object: THREE.Object3D): object is FogVolumeObject {
  return (object as FogVolumeObject).isFogVolume === true;
}
