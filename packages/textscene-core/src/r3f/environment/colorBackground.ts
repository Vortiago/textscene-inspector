/**
 * The colour background as a cube three draws through its cube background, so it passes through the
 * tone curve and the fog, as Godot tonemaps its clear colour and fogs it in the fog-only sky pass
 * (`forward_clustered/render_forward_clustered.cpp:1996-2014`). three's clear skips both.
 */

import * as THREE from 'three';
import { sRGBToLinearRGB } from '../../utils/colorSpace';
import type { Rgba } from '../../godot/math/math';

type SrgbColor = Pick<Rgba, 'r' | 'g' | 'b'>;

/**
 * A cube of the sRGB clear `color`, which already carries the background energy, linearised once.
 * The caller disposes of it.
 */
export function clearColorCube(color: SrgbColor): THREE.CubeTexture {
  return linearCube(sRGBToLinearRGB(color.r, color.g, color.b));
}

/**
 * The clear colour under fog, which Godot linearises twice: once as it sets the fog material's
 * `clear_color` (`:2014`), and once more because a sky material converts every Color parameter
 * (`environment/sky.cpp:193`, `material_storage.cpp:801`). Its brightness (`:2045`) applies the
 * energy again as `backgroundIntensity`. The caller disposes of it.
 */
export function foggedClearColorCube(color: SrgbColor): THREE.CubeTexture {
  return linearCube(sRGBToLinearRGB(...sRGBToLinearRGB(color.r, color.g, color.b)));
}

function linearCube([r, g, b]: [number, number, number]): THREE.CubeTexture {
  const faces = Array.from({ length: 6 }, () => {
    const face = new THREE.DataTexture(new Float32Array([r, g, b, 1]), 1, 1);
    face.type = THREE.FloatType;
    return face;
  });
  const cube = new THREE.CubeTexture(faces);
  cube.type = THREE.FloatType;
  cube.colorSpace = THREE.LinearSRGBColorSpace;
  cube.generateMipmaps = false;
  cube.minFilter = THREE.NearestFilter;
  cube.magFilter = THREE.NearestFilter;
  cube.needsUpdate = true;
  return cube;
}
