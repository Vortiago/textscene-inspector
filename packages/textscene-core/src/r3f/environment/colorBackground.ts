/**
 * The colour background as a texture three draws through its background mesh, so it passes through
 * the tone curve, as Godot tonemaps its clear colour, and under fog through the fog, as Godot fogs it
 * in the fog-only sky pass (`forward_clustered/render_forward_clustered.cpp:1996-2014`). three's
 * clear skips both.
 */

import * as THREE from 'three';
import { sRGBToLinearRGB } from '../../utils/colorSpace';
import type { Rgba } from '../../godot/math/math';

type SrgbColor = Pick<Rgba, 'r' | 'g' | 'b'>;
type LinearRgb = [number, number, number];

/**
 * A 1x1 texture of the sRGB clear `color`, which already carries the background energy, linearised
 * once. A flat texture, not a cube: three draws it as a clip-space quad, which fills the view under
 * any camera, while its cube background is a unit box that an orthographic view covers only in part.
 * The caller disposes of it.
 */
export function clearColorTexture(color: SrgbColor): THREE.DataTexture {
  const texture = linearTexel(sRGBToLinearRGB(color.r, color.g, color.b));
  sampleExactly(texture);
  texture.needsUpdate = true;
  return texture;
}

/**
 * The clear colour under fog, which Godot linearises twice: once as it sets the fog material's
 * `clear_color` (`:2014`), and once more because a sky material converts every Color parameter
 * (`environment/sky.cpp:193`, `material_storage.cpp:801`). Its brightness (`:2045`) applies the
 * energy again as `backgroundIntensity`. A cube, since the fog patches three's cube background,
 * which carries the view direction the fog reads. The caller disposes of it.
 */
export function foggedClearColorCube(color: SrgbColor): THREE.CubeTexture {
  const linear = sRGBToLinearRGB(...sRGBToLinearRGB(color.r, color.g, color.b));
  const cube = new THREE.CubeTexture(Array.from({ length: 6 }, () => linearTexel(linear)));
  sampleExactly(cube);
  cube.needsUpdate = true;
  return cube;
}

function linearTexel([r, g, b]: LinearRgb): THREE.DataTexture {
  const texel = new THREE.DataTexture(new Float32Array([r, g, b, 1]), 1, 1);
  texel.type = THREE.FloatType;
  return texel;
}

/** Linear float texels with no mipmaps or filtering, so a channel above 1 reaches the curve as is. */
function sampleExactly(texture: THREE.Texture): void {
  texture.type = THREE.FloatType;
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
}
