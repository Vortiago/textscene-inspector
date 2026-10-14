/**
 * The GPU passes that bake a sky's roughness layers, ported to GLSL ES from Godot 4.6.3's
 * `servers/rendering/renderer_rd/shaders/oct_inc.glsl` and `shaders/effects/octmap_downsampler.glsl`,
 * `octmap_roughness.glsl` and `octmap_filter.glsl`. Each pass draws one quad over its target and
 * works out its texel from `gl_FragCoord`, as Godot's compute passes do from the invocation ID.
 *
 * Portions ported from Godot Engine, used under the MIT licence:
 *
 *   Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md).
 *   Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 *
 * Portions ported from `octmap_downsampler.glsl` and `octmap_filter.glsl`, used under the MIT
 * licence:
 *
 *   Copyright 2016 Activision Publishing, Inc.
 *
 *   Permission is hereby granted, free of charge, to any person obtaining
 *   a copy of this software and associated documentation files (the
 *   "Software"), to deal in the Software without restriction, including
 *   without limitation the rights to use, copy, modify, merge, publish,
 *   distribute, sublicense, and/or sell copies of the Software, and to
 *   permit persons to whom the Software is furnished to do so, subject to
 *   the following conditions:
 *
 *   The above copyright notice and this permission notice shall be
 *   included in all copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 *   EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 *   MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 *   IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 *   CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 *   TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 *   SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * See THIRD-PARTY-NOTICES.md.
 */

import {
  FAST_FILTER_FRAME_LOWER_BOUND,
  FAST_FILTER_SUPER_TAPS_PER_FRAME,
  MOST_LAYER_SAMPLES,
} from '../../godot/skyReflection.js';
import { glslFloat } from '../environment/glslLiterals.js';

/** `oct_inc.glsl:2-41`. `borderSize` is 1 minus twice the padding in UV. */
const OCTMAP_GLSL = /* glsl */ `
vec3 octToVec3(vec2 e) {
  vec3 v = vec3(e.xy, 1.0 - abs(e.x) - abs(e.y));
  float t = max(-v.z, 0.0);
  v.xy += t * -sign(v.xy);
  return normalize(v);
}

vec3 octToVec3WithBorder(vec2 uv, float borderSize) {
  uv = (uv - 0.5) * (2.0 / borderSize);
  vec2 mask = step(vec2(1.0), abs(uv));
  uv = 2.0 * clamp(uv, -1.0, 1.0) - uv;
  uv = mix(uv, -uv, mask.yx);
  return octToVec3(uv);
}

vec2 octWrap(vec2 v) {
  vec2 signs = vec2(v.x >= 0.0 ? 1.0 : -1.0, v.y >= 0.0 ? 1.0 : -1.0);
  return (1.0 - abs(v.yx)) * signs;
}

vec2 vec3ToOctWithBorder(vec3 n, float borderSize) {
  n /= abs(n.x) + abs(n.y) + abs(n.z);
  n.xy = n.z >= 0.0 ? n.xy : octWrap(n.xy);
  return (n.xy * 0.5 + 0.5) * borderSize + (1.0 - borderSize) * 0.5;
}
`;

/**
 * Godot's radiance octmap, read from the sky's cube: each texel takes the radiance in its direction,
 * padding included, as Godot draws the sky into it.
 */
export const RADIANCE_OCTMAP_FRAGMENT_SHADER = /* glsl */ `
uniform samplerCube radiance;
uniform float size;
uniform float borderSize;
${OCTMAP_GLSL}
void main() {
  vec3 direction = octToVec3WithBorder(gl_FragCoord.xy / size, borderSize);
  gl_FragColor = vec4(textureLod(radiance, direction, 0.0).rgb, 1.0);
}
`;

/**
 * One mip of the chain, from the mip above (`octmap_downsampler.glsl:46-76`): four bilinear taps,
 * each weighed half by the octahedral Jacobian and half evenly.
 */
export const DOWNSAMPLE_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D source;
uniform float size;
uniform float borderSize;
${OCTMAP_GLSL}
float calcWeight(vec2 uv) {
  vec3 d = octToVec3WithBorder(uv * 0.5 + 0.5, borderSize);
  return 1.0 / pow(abs(d.z) + 1.0, 3.0);
}

void main() {
  vec2 id = floor(gl_FragCoord.xy);
  vec2 near = (id * 2.0 + 1.0 - 0.75) / size - 1.0;
  vec2 far = (id * 2.0 + 1.0 + 0.75) / size - 1.0;
  vec4 weights = vec4(
    calcWeight(near),
    calcWeight(vec2(far.x, near.y)),
    calcWeight(vec2(near.x, far.y)),
    calcWeight(far)
  );
  weights = weights * (0.5 / dot(weights, vec4(1.0))) + 0.125;
  vec4 colour = textureLod(source, near * 0.5 + 0.5, 0.0) * weights.x;
  colour += textureLod(source, vec2(far.x, near.y) * 0.5 + 0.5, 0.0) * weights.y;
  colour += textureLod(source, vec2(near.x, far.y) * 0.5 + 0.5, 0.0) * weights.z;
  colour += textureLod(source, far * 0.5 + 0.5, 0.0) * weights.w;
  gl_FragColor = colour;
}
`;

/**
 * What both filters share: the chain they read, and the direction through the centre of the cube
 * texel the fragment writes. A cube's faces are +X, -X, +Y, -Y, +Z, -Z, with `s` along a texel row
 * and `t` across the rows from the first row up (OpenGL ES 3.0 table 3.21).
 */
const LAYER_FILTER_GLSL = /* glsl */ `
uniform sampler2D chain;
uniform float lastMip;
uniform float borderSize;
uniform int face;
uniform float faceSize;
${OCTMAP_GLSL}
vec3 texelDirection() {
  vec2 st = gl_FragCoord.xy * 2.0 / faceSize - 1.0;
  float s = st.x;
  float t = st.y;
  if (face == 0) return normalize(vec3(1.0, -t, -s));
  if (face == 1) return normalize(vec3(-1.0, -t, s));
  if (face == 2) return normalize(vec3(s, 1.0, t));
  if (face == 3) return normalize(vec3(s, -1.0, -t));
  if (face == 4) return normalize(vec3(s, -t, 1.0));
  return normalize(vec3(-s, -t, -1.0));
}

vec3 chainAt(vec3 direction, float lod) {
  return textureLod(chain, vec3ToOctWithBorder(direction, borderSize), clamp(lod, 0.0, lastMip)).rgb;
}
`;

/**
 * GGX importance sampling (`octmap_roughness.glsl:62-84`): the layer's samples turned into a frame
 * around the texel's direction, read from the chain and weighed by their cosine. Each sample holds
 * its direction in that frame and the mip it reads.
 */
export const IMPORTANCE_SAMPLE_FRAGMENT_SHADER = /* glsl */ `
#define MOST_SAMPLES ${MOST_LAYER_SAMPLES}
uniform vec4 samples[MOST_SAMPLES];
uniform int sampleCount;
${LAYER_FILTER_GLSL}
void main() {
  vec3 normal = texelDirection();
  vec3 up = abs(normal.y) < 0.99999 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
  vec3 tangent = normalize(cross(up, normal));
  vec3 bitangent = cross(normal, tangent);
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < MOST_SAMPLES; i++) {
    if (i == sampleCount) break;
    vec4 layerSample = samples[i];
    vec3 direction = tangent * layerSample.x + bitangent * layerSample.y + normal * layerSample.z;
    sum += chainAt(direction, layerSample.w) * layerSample.z;
    total += layerSample.z;
  }
  gl_FragColor = vec4(sum / total, 1.0);
}
`;

/**
 * Godot's fast filter (`octmap_filter.glsl:94-217`): the level's taps in each of up to three frames
 * around the texel's direction, blended by how near the direction lies to each frame's axis. Each
 * uniform holds one part of the table, a `vec4` of four sub-taps per super-tap, frame by frame.
 * Godot's texture-array path runs it, with no lod offset.
 */
export const FAST_FILTER_FRAGMENT_SHADER = /* glsl */ `
#define SUPER_TAPS_PER_FRAME ${FAST_FILTER_SUPER_TAPS_PER_FRAME}
#define SUPER_TAPS (SUPER_TAPS_PER_FRAME * 3)
uniform vec4 frameX[SUPER_TAPS];
uniform vec4 frameY[SUPER_TAPS];
uniform vec4 frameZ[SUPER_TAPS];
uniform vec4 lod[SUPER_TAPS];
uniform vec4 weight[SUPER_TAPS];
${LAYER_FILTER_GLSL}
vec3 sum = vec3(0.0);
float total = 0.0;

void addTap(vec3 axisX, vec3 axisY, vec3 axisZ, float x, float y, float z, float tapLod, float tapWeight) {
  sum += chainAt(axisX * x + axisY * y + axisZ * z, tapLod) * tapWeight;
  total += tapWeight;
}

void addFrame(int axis, vec3 up, vec3 normal, vec2 others) {
  const float lowerBound = ${glslFloat(FAST_FILTER_FRAME_LOWER_BOUND)};
  float frameWeight = (max(others.x, others.y) - lowerBound) / (1.0 - lowerBound);
  if (frameWeight <= 0.0) return;
  vec3 axisX = normalize(cross(up, normal));
  vec3 axisY = cross(normal, axisX);
  for (int tap = 0; tap < SUPER_TAPS_PER_FRAME; tap++) {
    int index = axis * SUPER_TAPS_PER_FRAME + tap;
    vec4 x = frameX[index];
    vec4 y = frameY[index];
    vec4 z = frameZ[index];
    vec4 tapLods = lod[index];
    vec4 tapWeights = weight[index] * frameWeight;
    addTap(axisX, axisY, normal, x.x, y.x, z.x, tapLods.x, tapWeights.x);
    addTap(axisX, axisY, normal, x.y, y.y, z.y, tapLods.y, tapWeights.y);
    addTap(axisX, axisY, normal, x.z, y.z, z.z, tapLods.z, tapWeights.z);
    addTap(axisX, axisY, normal, x.w, y.w, z.w, tapLods.w, tapWeights.w);
  }
}

void main() {
  vec3 normal = texelDirection();
  vec3 along = abs(normal);
  addFrame(0, vec3(1.0, 0.0, 0.0), normal, along.yz);
  addFrame(1, vec3(0.0, 1.0, 0.0), normal, along.xz);
  addFrame(2, vec3(0.0, 0.0, 1.0), normal, along.xy);
  gl_FragColor = vec4(max(vec3(0.0), sum / total), 1.0);
}
`;
