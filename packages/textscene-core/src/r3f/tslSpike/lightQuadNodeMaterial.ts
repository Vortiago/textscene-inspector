/**
 * The cookie quad of a PointLight2D as a TSL node material: the unshadowed light pass of
 * `../lighting2d/lightQuad.ts`, `rgb = cookie.rgb * color * energy` and `a = cookie.a`. A light that
 * casts or filters a shadow stays on the classic material.
 */

import * as THREE from 'three';
import { mix, texture, textureSize, uniform, uv, vec2, vec4 } from 'three/tsl';
import { NodeMaterial, type Node } from 'three/webgpu';
import type { Rgba } from '../../godot/math/math.js';
import { canvasItemFacing } from '../canvasItemFacing.js';

export interface LightQuadNodeOptions {
  readonly cookie: THREE.Texture;
  /** `Light2D.color`. */
  readonly color: Rgba;
  /** `Light2D.energy`. */
  readonly energy: number;
  /** 1 for a linear cookie tap, 0 for a nearest one, as `sampleCookie` of `lightQuadShaders.ts` reads it. */
  readonly edgeFade: number;
  /** The blend and depth state of `accumulationState`. */
  readonly state: Partial<THREE.MaterialParameters>;
}

/** `sampleCookie` (`lightQuadShaders.ts`): the tap, faded toward the atlas border Godot clears. */
function cookieTap(cookie: THREE.Texture, edgeFade: number) {
  // three's types give `textureSize` no vector type (@types/three 0.187).
  const size = vec2(textureSize(texture(cookie)) as unknown as Node<'ivec2'>);
  const texel = uv().mul(size);
  const inside = texel.min(size.sub(texel)).add(0.5).min(vec2(1));
  return texture(cookie, uv()).mul(mix(1, inside.x.mul(inside.y), uniform(edgeFade)));
}

export function createLightQuadNodeMaterial(options: LightQuadNodeOptions): NodeMaterial {
  const { cookie, color, energy, edgeFade, state } = options;
  const material = new NodeMaterial();
  const tap = cookieTap(cookie, edgeFade);
  const tint = uniform(new THREE.Vector3(color.r, color.g, color.b));
  material.fragmentNode = vec4(tap.rgb.mul(tint).mul(uniform(energy)), tap.a);
  material.setValues({ ...canvasItemFacing(), ...state });
  return material;
}
