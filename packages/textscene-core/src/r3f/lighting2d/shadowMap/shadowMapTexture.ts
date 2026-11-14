/**
 * The one-row texture a shadowed 2D light keeps its map in, and the uniforms its taps read it
 * through. A PointLight2D's polar map and a DirectionalLight2D's map differ only in how a tap past
 * an end reads.
 */

/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import * as THREE from 'three';
import { imageSize } from '../../../resources/formats/image/imagePixels';

/**
 * How a tap past an end of the row reads. A polar map repeats on u, as Godot's atlas sampler does
 * (`renderer_canvas_render_rd.cpp:975-980,1930-1934`), so a tap at bin −1 reads the last bin. A
 * directional map clamps.
 */
export type ShadowMapEdge = 'repeat' | 'clamp';

/**
 * A map of `bins` texels, all zero: Godot's `R32_SFLOAT` atlas row behind a nearest sampler. Float32,
 * since `texture_shadow` compares texel by texel and a half float rounds a depth near 1 by 1/2048 of
 * `z_far`, which moves the shadow edge.
 */
export function createShadowMapTexture(bins: number, edge: ShadowMapEdge): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Float32Array(bins), bins, 1, THREE.RedFormat, THREE.FloatType);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = edge === 'repeat' ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = false;
  return texture;
}

/** Uploads `bins`, exactly as many as the texture holds. */
export function writeShadowMap(texture: THREE.DataTexture, bins: Float32Array): void {
  const data = texture.image.data as Float32Array;
  // `set` accepts a shorter source and keeps the old bins past its end.
  if (bins.length !== data.length) {
    throw new RangeError(`expected a shadow map of ${data.length} bins, got ${bins.length}`);
  }
  data.set(bins);
  texture.needsUpdate = true;
}

/**
 * `uShadowMap` and the `uShadowBins` its taps divide by, written from the map's own width so the
 * texture and every tap agree on the atlas size.
 */
export function shadowMapUniforms(map: THREE.Texture): {
  uShadowMap: THREE.IUniform<THREE.Texture>;
  uShadowBins: THREE.IUniform<number>;
} {
  const size = imageSize(map.image);
  if (!size) throw new Error('expected a shadow map with an image, got a texture without one');
  return { uShadowMap: { value: map }, uShadowBins: { value: size.width } };
}
