/**
 * A small half-float OpenEXR atlas written in memory, for a test that needs the decoded values
 * and not a real bake. Decoding the vendored 2048x2048 atlas takes about 0.6 s a test, which
 * outlasts the 5 s limit when the whole suite loads the machine.
 */

import * as THREE from 'three';
import { EXRExporter, NO_COMPRESSION } from 'three/addons/exporters/EXRExporter.js';

/** One texel's red, green, blue and alpha. */
type Texel = readonly [number, number, number, number];

/** `texelAt` names each texel by its column and by its row from the bottom, as a DataTexture stores them. */
export async function smallExrBytes(
  width: number,
  height: number,
  texelAt: (x: number, y: number) => Texel
): Promise<ArrayBuffer> {
  const data = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      texelAt(x, y).forEach((value, channel) => {
        data[(y * width + x) * 4 + channel] = value;
      });
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  const exr = await new EXRExporter().parse(texture, {
    type: THREE.HalfFloatType,
    // The default ZIP packs 16 rows a block and corrupts an image shorter than that.
    compression: NO_COMPRESSION,
  });
  return exr.buffer.slice(exr.byteOffset, exr.byteOffset + exr.byteLength) as ArrayBuffer;
}
