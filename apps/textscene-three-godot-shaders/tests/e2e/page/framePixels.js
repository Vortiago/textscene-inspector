import * as THREE from 'three';

/** The pixels of `scene` from `camera` at `width` by `height`, in a target of `colorSpace` and `samples`. */
export function framePixels(
  renderer,
  scene,
  camera,
  { width, height, colorSpace = THREE.NoColorSpace, samples = 0 }
) {
  const target = new THREE.WebGLRenderTarget(width, height, { samples, stencilBuffer: true });
  target.texture.colorSpace = colorSpace;
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const pixels = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  renderer.setRenderTarget(null);
  target.dispose();
  return withOpaqueAlpha(topRowFirst(pixels, width, height));
}

/** An opaque viewport's image is RGB8, so its alpha reads as 1 (`texture_storage.cpp:3574`). */
function withOpaqueAlpha(pixels) {
  for (let alpha = 3; alpha < pixels.length; alpha += 4) pixels[alpha] = 255;
  return pixels;
}

/** GL reads the bottom row first, and Godot's image holds the top row first. */
function topRowFirst(pixels, width, height) {
  const rowBytes = width * 4;
  const flipped = new Uint8Array(pixels.length);
  for (let row = 0; row < height; row += 1) {
    flipped.set(pixels.subarray(row * rowBytes, (row + 1) * rowBytes), (height - 1 - row) * rowBytes);
  }
  return flipped;
}
