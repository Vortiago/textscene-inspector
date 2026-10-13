/**
 * The colour background under fog, as a cube three draws through its cube background, which the
 * fog patches as Godot's fog-only sky pass fogs the clear colour
 * (`forward_clustered/render_forward_clustered.cpp:1996-2014`).
 */

import * as THREE from 'three';
import { godotColorToLinear } from '../godotColor';

/**
 * A cube of the sRGB clear `color`, which already carries the background energy. Godot's pass
 * applies the energy a second time, as its brightness (`:2045`), which the caller sets as
 * `backgroundIntensity`. The caller owns the cube and disposes of it.
 */
export function clearColorCube(color: { r: number; g: number; b: number }): THREE.CubeTexture {
  const linear = fogPassClearColor(color);
  const faces = Array.from({ length: 6 }, () => {
    const face = new THREE.DataTexture(new Float32Array([linear.r, linear.g, linear.b, 1]), 1, 1);
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

/**
 * Godot converts the clear colour to linear twice: once before it sets the pass's `clear_color`
 * (`:2004`, `:2014`), and again as the material writes a Color into a plain `vec4` uniform
 * (`storage_rd/material_storage.cpp:801`, `storage/variant_converters.h:207-210`).
 */
function fogPassClearColor(color: { r: number; g: number; b: number }): THREE.Color {
  return godotColorToLinear(godotColorToLinear(color));
}
