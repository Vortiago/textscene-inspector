/**
 * The colour background under fog, as a cube three draws through its cube background, which the
 * fog patches as Godot's fog-only sky pass fogs the clear colour
 * (`forward_clustered/render_forward_clustered.cpp:1996-2014`).
 */

import * as THREE from 'three';

/**
 * A cube of the linear clear `color`, which already carries the background energy. Godot's pass
 * applies the energy a second time, as its brightness (`:2045`), which the caller sets as
 * `backgroundIntensity`. The caller owns the cube and disposes of it.
 */
export function clearColorCube(color: THREE.Color): THREE.CubeTexture {
  const faces = Array.from({ length: 6 }, () => {
    const face = new THREE.DataTexture(new Float32Array([color.r, color.g, color.b, 1]), 1, 1);
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
