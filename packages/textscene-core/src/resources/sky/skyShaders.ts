/**
 * Godot's sky shaders from `scene/resources/3d/sky_material.cpp` (Godot 4.6),
 * ported to GLSL ES. `EYEDIR` and `LIGHTn_*` become a varying and uniforms,
 * `COLOR` becomes `gl_FragColor`. The maths is unchanged, not approximated.
 *
 * ---------------------------------------------------------------------------
 * Portions of this file are derived from Godot Engine, used under the MIT
 * licence:
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
 * ---------------------------------------------------------------------------
 */

import type { SkyProperties } from './types';

/**
 * The sky draws on the inside of a unit cube, so the object-space position is
 * the eye direction, Godot's `EYEDIR`.
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

export const PROCEDURAL_SKY_FRAGMENT_SHADER = /* glsl */ `
varying vec3 vEyeDirection;

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

void main() {
  vec3 eyedir = normalize(vEyeDirection);
  float v_angle = clamp(eyedir.y, -1.0, 1.0);
  vec3 sky = mix(sky_top_color, sky_horizon_color, clamp(pow(1.0 - v_angle, inv_sky_curve), 0.0, 1.0));
${[0, 1, 2, 3].map(sunDisk).join('\n')}

  vec3 ground = mix(ground_bottom_color, ground_horizon_color, clamp(pow(1.0 + v_angle, inv_ground_curve), 0.0, 1.0));

  gl_FragColor = vec4(mix(ground, sky, step(0.0, eyedir.y)) * exposure, 1.0);
}
`;

export const PANORAMA_SKY_FRAGMENT_SHADER = /* glsl */ `
varying vec3 vEyeDirection;

uniform sampler2D source_panorama;
uniform bool has_panorama;
uniform float exposure;

const float INV_PI = 0.3183098861837907;
const float INV_TWO_PI = 0.15915494309189535;

void main() {
  if (!has_panorama) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  vec3 eyedir = normalize(vEyeDirection);
  // Godot's SKY_COORDS is the equirectangular projection of EYEDIR: u wraps
  // atan(x,-z) into [0,1) so -Z maps to the texture's left edge (u=0), NOT its
  // centre — a +0.5 instead offset the whole sky 180deg in azimuth. V uses
  // acos(-y): the texture loads flipY=true (as the panorama-fixture measurement
  // against real Godot confirms), so without the negation the sky renders
  // upside-down. Verified pixel-for-pixel against Godot on unit-sky-panorama.
  vec2 uv = vec2(fract(atan(eyedir.x, -eyedir.z) * INV_TWO_PI), acos(-eyedir.y) * INV_PI);
  gl_FragColor = vec4(texture2D(source_panorama, uv).rgb * exposure, 1.0);
}
`;

export const PHYSICAL_SKY_FRAGMENT_SHADER = /* glsl */ `
varying vec3 vEyeDirection;

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

float henyey_greenstein(float cos_theta, float g) {
  const float k = 0.0795774715459;
  return k * (1.0 - g * g) / (pow(1.0 + g * g - 2.0 * g * cos_theta, 1.5));
}

void main() {
  vec3 eyedir = normalize(vEyeDirection);

  if (!LIGHT0_ENABLED) {
    // No sun: Godot shows only the night sky, which we do not sample.
    gl_FragColor = vec4(vec3(0.0) * exposure, 1.0);
    return;
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
  gl_FragColor = vec4(pow(color, vec3(1.0 / (1.2 + (1.2 * sun_fade)))) * exposure, 1.0);
}
`;

export function skyFragmentShader(sky: SkyProperties): string {
  switch (sky.kind) {
    case 'procedural':
      return PROCEDURAL_SKY_FRAGMENT_SHADER;
    case 'panorama':
      return PANORAMA_SKY_FRAGMENT_SHADER;
    case 'physical':
      return PHYSICAL_SKY_FRAGMENT_SHADER;
  }
}
