/**
 * Godot's sky shaders from `scene/resources/3d/sky_material.cpp` (Godot 4.6),
 * ported to GLSL ES. Each `sky()` becomes `vec3 godotSky(vec3 eyedir)`, which
 * returns `COLOR` for `EYEDIR`, and `LIGHTn_*` become uniforms. The maths is
 * unchanged, and `SKY_COORDS` keeps Godot's own approximations.
 *
 * Portions ported from Godot Engine, used under the MIT licence:
 *
 *   Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md).
 *   Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
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

import type { SkyProperties } from './types';
import { HENYEY_GREENSTEIN_GLSL } from '../../r3f/henyeyGreenstein';
import { GODOT_SKY_COORDS_GLSL } from '../../godot/rendering/environment/skyCoords';

/**
 * The radiance bake draws the sky on the inside of a unit cube, so the
 * object-space position is the eye direction, Godot's `EYEDIR`.
 */
export const SKY_VERTEX_SHADER = /* glsl */ `
varying vec3 vEyeDirection;

void main() {
  vEyeDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** The four light slots Godot's sky shader exposes, as GLSL declarations. */
const LIGHT_UNIFORMS = [0, 1, 2, 3]
  .map(
    (i) => `uniform bool LIGHT${i}_ENABLED;
uniform vec3 LIGHT${i}_DIRECTION;
uniform vec3 LIGHT${i}_COLOR;
uniform float LIGHT${i}_ENERGY;
uniform float LIGHT${i}_SIZE;`
  )
  .join('\n');

/**
 * The procedural sky's per-light sun disk. Godot writes it out four times
 * because its sky shader has no arrays, so it is generated here.
 */
const sunDisk = (i: number) => `
  if (LIGHT${i}_ENABLED) {
    float sun_angle_${i} = dot(LIGHT${i}_DIRECTION, eyedir);
    float sun_size_${i} = cos(LIGHT${i}_SIZE);
    if (sun_angle_${i} > sun_size_${i}) {
      sky = LIGHT${i}_COLOR * LIGHT${i}_ENERGY;
    } else if (sun_angle_${i} > sun_angle_max) {
      float c2_${i} = (sun_size_${i} - sun_angle_${i}) / (sun_size_${i} - sun_angle_max);
      sky = mix(sky, LIGHT${i}_COLOR * LIGHT${i}_ENERGY, clamp(pow(1.0 - c2_${i}, inv_sun_curve), 0.0, 1.0));
    }
  }`;

const PROCEDURAL_SKY = /* glsl */ `
uniform vec3 sky_top_color;
uniform vec3 sky_horizon_color;
uniform float inv_sky_curve;
uniform vec3 ground_bottom_color;
uniform vec3 ground_horizon_color;
uniform float inv_ground_curve;
uniform float sun_angle_max;
uniform float inv_sun_curve;
uniform float exposure;
${LIGHT_UNIFORMS}

vec3 godotSky(vec3 eyedir) {
  float v_angle = clamp(eyedir.y, -1.0, 1.0);
  vec3 sky = mix(sky_top_color, sky_horizon_color, clamp(pow(1.0 - v_angle, inv_sky_curve), 0.0, 1.0));
${[0, 1, 2, 3].map(sunDisk).join('\n')}

  vec3 ground = mix(ground_bottom_color, ground_horizon_color, clamp(pow(1.0 + v_angle, inv_ground_curve), 0.0, 1.0));

  return mix(ground, sky, step(0.0, eyedir.y)) * exposure;
}
`;

const PANORAMA_SKY = /* glsl */ `
uniform sampler2D source_panorama;
uniform bool has_panorama;
uniform float exposure;

${GODOT_SKY_COORDS_GLSL}
vec3 godotSky(vec3 eyedir) {
  // An unset panorama samples \`hint_default_black\`.
  if (!has_panorama) return vec3(0.0);
  // The panorama uploads with \`flipY\`, so its first row is v = 1.
  vec2 coords = godotSkyCoords(eyedir);
  return texture2D(source_panorama, vec2(coords.x, 1.0 - coords.y)).rgb * exposure;
}
`;

const PHYSICAL_SKY = /* glsl */ `
uniform float rayleigh;
uniform vec3 rayleigh_color;
uniform float mie;
uniform float mie_eccentricity;
uniform vec3 mie_color;
uniform float turbidity;
uniform float sun_disk_scale;
uniform vec3 ground_color;
uniform float exposure;
${LIGHT_UNIFORMS}

const vec3 UP = vec3(0.0, 1.0, 0.0);
const float PI_ = 3.141592653589793;

// Optical length at zenith for molecules.
const float rayleigh_zenith_size = 8.4e3;
const float mie_zenith_size = 1.25e3;

${HENYEY_GREENSTEIN_GLSL}
vec3 godotSky(vec3 eyedir) {
  if (!LIGHT0_ENABLED) {
    // No sun: Godot shows only the night sky, which we do not sample.
    return vec3(0.0);
  }

  float zenith_angle = clamp(dot(UP, normalize(LIGHT0_DIRECTION)), -1.0, 1.0);
  float sun_energy = max(0.0, 0.757 * zenith_angle) * LIGHT0_ENERGY;
  float sun_fade = 1.0 - clamp(1.0 - exp(LIGHT0_DIRECTION.y), 0.0, 1.0);

  // Rayleigh coefficients.
  float rayleigh_coefficient = rayleigh - (1.0 * (1.0 - sun_fade));
  vec3 rayleigh_beta = rayleigh_coefficient * rayleigh_color * 0.0001;
  // Mie coefficients from Preetham.
  vec3 mie_beta = turbidity * mie * mie_color * 0.000434;

  // Optical length.
  float zenith = max(0.0, dot(UP, eyedir));
  float optical_mass = 1.0 / (zenith + 0.15 * pow(3.885 + 54.5 * zenith, -1.253));
  float rayleigh_scatter = rayleigh_zenith_size * optical_mass;
  float mie_scatter = mie_zenith_size * optical_mass;

  // Light extinction based on thickness of atmosphere.
  vec3 extinction = exp(-(rayleigh_beta * rayleigh_scatter + mie_beta * mie_scatter));

  // In scattering.
  float cos_theta = dot(eyedir, normalize(LIGHT0_DIRECTION));

  float rayleigh_phase = (3.0 / (16.0 * PI_)) * (1.0 + pow(cos_theta * 0.5 + 0.5, 2.0));
  vec3 betaRTheta = rayleigh_beta * rayleigh_phase;

  float mie_phase = henyey_greenstein(cos_theta, mie_eccentricity);
  vec3 betaMTheta = mie_beta * mie_phase;

  vec3 Lin = pow(sun_energy * ((betaRTheta + betaMTheta) / (rayleigh_beta + mie_beta)) * (1.0 - extinction), vec3(1.5));
  Lin *= mix(vec3(1.0), pow(sun_energy * ((betaRTheta + betaMTheta) / (rayleigh_beta + mie_beta)) * extinction, vec3(0.5)), clamp(pow(1.0 - zenith_angle, 5.0), 0.0, 1.0));

  // Hack in the ground color.
  Lin *= mix(ground_color, vec3(1.0), smoothstep(-0.1, 0.1, dot(UP, eyedir)));

  // Solar disk and out-scattering.
  float sunAngularDiameterCos = cos(LIGHT0_SIZE * sun_disk_scale);
  float sunAngularDiameterCos2 = cos(LIGHT0_SIZE * sun_disk_scale * 0.5);
  float sundisk = smoothstep(sunAngularDiameterCos, sunAngularDiameterCos2, cos_theta);
  vec3 L0 = (sun_energy * extinction) * sundisk * LIGHT0_COLOR;

  vec3 color = Lin + L0;
  return pow(color, vec3(1.0 / (1.2 + (1.2 * sun_fade)))) * exposure;
}
`;

/** GLSL that declares the uniforms of `sky` and defines `vec3 godotSky(vec3 eyedir)`, its `sky()`. */
export function skyGlsl(sky: SkyProperties): string {
  switch (sky.kind) {
    case 'procedural':
      return PROCEDURAL_SKY;
    case 'panorama':
      return PANORAMA_SKY;
    case 'physical':
      return PHYSICAL_SKY;
  }
}

/** The radiance bake's fragment shader: `sky` at the eye direction of each texel. */
export function skyFragmentShader(sky: SkyProperties): string {
  return /* glsl */ `varying vec3 vEyeDirection;
${skyGlsl(sky)}
void main() {
  gl_FragColor = vec4(godotSky(normalize(vEyeDirection)), 1.0);
}
`;
}
