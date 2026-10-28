/**
 * The shown sky's radiance, which every reader of the sky samples: the lit materials
 * (`../godotSkyLighting.ts`), the depth fog's aerial perspective and the volumetric fog's ambient, as
 * Godot binds one radiance texture to all three (`environment/fog.cpp:981-982`). It holds Godot's
 * radiance layers, which each sky keeps in an octmap array of its own, their layout, the energy and
 * the rotation the sky was baked at, and the sky's share of the ambient. Each scene with a sky shows
 * its own before each of its renders, so a main view and a sub-viewport with its own sky each read
 * their own, and a scene without one reads black, as Godot's readers do.
 */

import * as THREE from 'three';
import { handleOf, installedSlot, leaveSlot, showInSlot } from '../sharedTexture.js';
import type { SkyLayers } from '../../resources/sky/skyLayers.js';
import { OCTMAP_GLSL } from '../../resources/sky/skyLayerShaders.js';
import { installedOr } from '../shaderPatch/litUniform.js';
import { worldToSky } from './skyRotation.js';

export const SKY_RADIANCE_UNIFORMS = {
  /** The layer array every reader samples. */
  layers: 'godotSkyLayers',
  /** The two-element `vec4` array of the shown sky's share of the ambient, its layout and its energy. */
  shown: 'godotShownSky',
  /** World to sky space, the inverse of `sky_rotation`'s basis. */
  rotation: 'godotSkyRotation',
} as const;

const { layers: LAYERS, shown: SHOWN, rotation: ROTATION } = SKY_RADIANCE_UNIFORMS;

/**
 * The array a reader samples the layers through. three never uploads it, as its version stays 0
 * (three r186 `WebGLTextures.js:626`), and binds whatever handle it holds on a renderer: the array
 * of the sky shown last, or three's empty array.
 */
export const skyLayersSlot = installedSlot(LAYERS, THREE.DataArrayTexture);

/**
 * The shown sky's `ambient_light_sky_contribution`, its layers' border size, the scale from a
 * squared screen derivative to squared texels and its last mip, then the energy its radiance holds.
 * `UniformsUtils.cloneUniforms` keeps a typed array by reference (three r186
 * `UniformsUtils.js:43-64`), so every material reads this buffer. After a dev server reloads this
 * module, it is the buffer the earlier evaluation installed.
 */
export const shownSky = installedOr(SHOWN, Float32Array, () => Float32Array.of(1, 1, 1, 0, 0, 0, 0, 0));

const IDENTITY_BASIS = Float32Array.of(1, 0, 0, 0, 1, 0, 0, 0, 1);

/** Where `shownSky` holds the energy, which the fogs read and the surfaces do not. */
export const SHOWN_ENERGY = 4;

/** World to sky space, column-major, read as `shownSky` is. Identity while no sky shows. */
export const skyRotation = installedOr(ROTATION, Float32Array, () => IDENTITY_BASIS.slice());

/**
 * The uniforms, the layer reads and `vec3_to_oct_lod` (`oct_inc.glsl:43-51`) of the shown sky. A
 * program may include it more than once, as a lit material with fog does.
 */
export const SKY_RADIANCE_GLSL = /* glsl */ `
#ifndef GODOT_SKY_RADIANCE
#define GODOT_SKY_RADIANCE
uniform highp sampler2DArray ${LAYERS};
uniform vec4 ${SHOWN}[ 2 ];
uniform mat3 ${ROTATION};
#define GODOT_SKY_CONTRIBUTION ${SHOWN}[ 0 ].x
#define GODOT_SKY_BORDER_SIZE ${SHOWN}[ 0 ].y
#define GODOT_SKY_DERIVATIVE_SCALE ${SHOWN}[ 0 ].z
#define GODOT_SKY_LAST_MIP ${SHOWN}[ 0 ].w
#define GODOT_SKY_ENERGY ${SHOWN}[ 1 ].x
${OCTMAP_GLSL}
// The mip whose texels span the octmap distance the direction moves across a pixel, at most the last.
float godotSkyLod( const in vec3 direction ) {
	vec3 directionDdx = dFdx( direction );
	vec3 directionDdy = dFdy( direction );
	float texelsSqr = max( dot( directionDdx, directionDdx ), dot( directionDdy, directionDdy ) ) * GODOT_SKY_DERIVATIVE_SCALE;
	return min( 0.25 * log2( texelsSqr + 1e-6 ), GODOT_SKY_LAST_MIP );
}

// Radiance layer \`layer\` at the octmap texel \`uv\`, at mip \`lod\`. A layer past the last reads the last.
vec3 godotSkyRead( const in vec2 uv, const in float layer, const in float lod ) {
	return textureLod( ${LAYERS}, vec3( uv, layer ), lod ).rgb;
}

// Radiance layer \`layer\` along the sky-space \`direction\`, at mip \`lod\`.
vec3 godotSkyReadAlong( const in vec3 direction, const in float layer, const in float lod ) {
	return godotSkyRead( vec3ToOctWithBorder( direction, GODOT_SKY_BORDER_SIZE ), layer, lod );
}

// The two layers around \`layerPosition\` along the sky-space \`direction\`, blended by its fraction,
// at the mip the direction's screen derivative picks.
vec3 godotSkyBlend( const in vec3 direction, const in float layerPosition ) {
	float layer;
	float blend = modf( layerPosition, layer );
	vec2 uv = vec3ToOctWithBorder( direction, GODOT_SKY_BORDER_SIZE );
	float lod = godotSkyLod( direction );
	return mix( godotSkyRead( uv, layer, lod ), godotSkyRead( uv, layer + 1.0, lod ), blend );
}
#endif
`;

/** The uniforms a shader that includes `SKY_RADIANCE_GLSL` reads, one record per material. */
export function skyRadianceUniforms(): Record<string, THREE.IUniform> {
  return {
    [LAYERS]: { value: skyLayersSlot },
    [SHOWN]: { value: shownSky },
    [ROTATION]: { value: skyRotation },
  };
}

/** What a sky's radiance holds, fixed for the life of its bake. */
export interface SkyBake {
  /** The energy Godot bakes into the radiance: `background_energy_multiplier` times the exposure. */
  energy: number;
  /** `sky_rotation` as three's Euler. */
  rotation: THREE.Euler;
}

/**
 * A sky's baked layers on one renderer, in an array of their own as Godot keeps a radiance texture
 * per sky (`servers/rendering/renderer_rd/environment/sky.h:251`). The sky's environment owns the
 * array, so skies that take turns in one frame bake and upload nothing more.
 */
export class SkyRadiance {
  private readonly energy: number;
  private readonly toSky: ArrayLike<number>;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly layers: SkyLayers,
    { energy, rotation }: SkyBake
  ) {
    this.energy = energy;
    this.toSky = worldToSky(rotation, new THREE.Matrix3()).elements;
  }

  /**
   * Points every reader at this array for the renders that follow, and writes the array's layout,
   * `contribution` (`ambient_light_sky_contribution`), the energy and the rotation. Each material
   * holds a uniform of its own (three r186 `UniformsUtils.js:24`), all on the one slot, so the slot
   * takes the array's handle.
   */
  show(contribution: number): void {
    const { borderSize, pixelSize, downsampledSizes } = this.layers.layout;
    shownSky[0] = contribution;
    shownSky[1] = borderSize;
    // One over `vec3_to_oct_lod`'s `pixel_size_sqr` (`oct_inc.glsl:46`), so a fragment multiplies.
    shownSky[2] = 1 / (4 * pixelSize * pixelSize);
    shownSky[3] = downsampledSizes.length;
    shownSky[SHOWN_ENERGY] = this.energy;
    skyRotation.set(this.toSky);
    showInSlot(this.renderer, skyLayersSlot, this.layers.target.texture);
  }

  /** Leaves the slot off this array before it is freed. */
  hide(): void {
    leaveSlot(this.renderer, skyLayersSlot, this.layers.target.texture);
  }
}

/**
 * Leaves the renders that follow, of a scene without a sky, reading a black radiance in the sky's
 * own space, as Godot binds a black texture when the environment has no sky (`fog.cpp:980`).
 */
export function hideShownSky(): void {
  shownSky[SHOWN_ENERGY] = 0;
  skyRotation.set(IDENTITY_BASIS);
}

/** The layer array `renderer` reads now, which changes with each sky shown. */
export function shownLayers(renderer: THREE.WebGLRenderer): WebGLTexture | undefined {
  return handleOf(renderer, skyLayersSlot).__webglTexture;
}
