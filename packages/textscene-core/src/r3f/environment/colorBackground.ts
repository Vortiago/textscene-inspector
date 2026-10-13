/**
 * The colour background under fog, as a cube three draws through its cube background, which the
 * fog patches as Godot's fog-only sky pass fogs the clear colour
 * (`forward_clustered/render_forward_clustered.cpp:1996-2014`).
 */

import * as THREE from 'three';
import type { Color } from '../../utils/colorParser';
import { sRGBToLinearRGB } from '../../utils/colorSpace';

/**
 * A cube of the sRGB clear `color`, which already carries the background energy. Godot linearises it
 * twice: once as it sets the fog material's `clear_color` (`:2014`), and once more because a sky
 * material converts every Color parameter (`environment/sky.cpp:193`, `material_storage.cpp:801`).
 * Its brightness (`:2045`) applies the energy again, which the caller sets as `backgroundIntensity`.
 * The caller owns the cube and disposes of it.
 */
export function clearColorCube(color: Pick<Color, 'r' | 'g' | 'b'>): THREE.CubeTexture {
  const [r, g, b] = sRGBToLinearRGB(...sRGBToLinearRGB(color.r, color.g, color.b));
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
