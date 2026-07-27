/**
 * The quad a PointLight2D contributes to the accumulation buffer.
 *
 * It emits Godot's light term and nothing else:
 *
 *   light = cookie.rgb * cookie.a * color * energy
 *
 * unclamped and in sRGB, because the buffer is half-float and the multiply
 * against each item's albedo happens later. `energy` is applied HERE, in sRGB,
 * which is the space Godot's canvas works in — scaling a linear colour instead
 * raises it by only `energy^(1/2.2)` once re-encoded, which is why lights read
 * dim when the multiply is folded into a material colour.
 *
 * Blend mode selects how the term accumulates: ADD and SUB add and subtract it,
 * MIX is not expressible as an accumulation (it interpolates toward the light
 * colour against the destination) and is documented as an approximation.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import * as THREE from 'three';
import type { Color } from '../../nodes/base/node2d/types.js';

const VERTEX = /* glsl */ `
varying vec2 vLightUv;
void main() {
  vLightUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * The cookie arrives decoded to linear (three tags loaded textures
 * `SRGBColorSpace`), so it is re-encoded to recover Godot's texel before the
 * light maths. Nothing is clamped: the target is half-float.
 */
const FRAGMENT = /* glsl */ `
uniform sampler2D uCookie;
uniform vec3 uColor;
uniform float uEnergy;
varying vec2 vLightUv;

vec3 lightToSrgb(vec3 c) {
  return mix(c * 12.92, pow(max(c, vec3(0.0)), vec3(0.41666)) * 1.055 - 0.055, step(0.0031308, c));
}

void main() {
  vec4 cookie = texture2D(uCookie, vLightUv);
  gl_FragColor = vec4(lightToSrgb(cookie.rgb) * cookie.a * uColor * uEnergy, 1.0);
}
`;

/** Godot `Light2D.BlendMode`: 0 ADD, 1 SUB, 2 MIX. */
function accumulationBlend(blendMode: number): Partial<THREE.ShaderMaterialParameters> {
  return {
    blending: THREE.CustomBlending,
    blendEquation: blendMode === 1 ? THREE.ReverseSubtractEquation : THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
  };
}

export function createLightQuadMaterial(
  cookie: THREE.Texture,
  color: Color,
  energy: number,
  blendMode: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uCookie: { value: cookie },
      uColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
      uEnergy: { value: energy },
    },
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    ...accumulationBlend(blendMode),
  });
}
