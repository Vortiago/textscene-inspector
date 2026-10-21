/**
 * An OpenEXR image decoded to half-float RGBA, as Godot's `Image::load_exr` reads the HDR atlas a
 * lightmap bake saves (`scene/3d/lightmap_gi.cpp:879`). three's EXRLoader loads on demand, so it
 * stays out of the bundle a scene without a lightmap loads.
 */

import * as THREE from 'three';
import { reversedRows } from '../../../utils/reversedRows';

/** RGBA half-float bits, top row first. */
export interface HalfFloatPixels {
  data: Uint16Array;
  width: number;
  height: number;
}

/**
 * Half floats, not floats: a bake saves half floats (`Image::FORMAT_RGBAH`,
 * `lightmapper_rd.cpp:851`), so no value is lost, and the bits upload with no per-texel conversion.
 */
export async function decodeExr(bytes: ArrayBuffer): Promise<HalfFloatPixels> {
  const { EXRLoader } = await import('three/addons/loaders/EXRLoader.js');
  const decoded = new EXRLoader().setDataType(THREE.HalfFloatType).parse(bytes);
  if (decoded.format !== THREE.RGBAFormat) {
    throw new Error(`expected an RGB or RGBA OpenEXR image, got three format ${String(decoded.format)}`);
  }
  const width = decoded.width!;
  const height = decoded.height!;
  // EXRLoader writes the bottom row first, for a texture that uploads without `flipY`.
  return { data: reversedRows(decoded.data as Uint16Array, width, height), width, height };
}
