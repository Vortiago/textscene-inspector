import * as THREE from 'three';
import { handleOf, installedSlot, leaveSlot, showInSlot } from '../sharedTexture.js';
import type { SkyLayers } from '../../resources/sky/skyLayers.js';
import { OCTMAP_GLSL } from '../../resources/sky/skyLayerShaders.js';
import { installedOr } from '../shaderPatch/litUniform.js';
import { worldToSky } from './skyRotation.js';
import {
  MAX_ROUGHNESS_LOD,
  SKY_ROUGHNESS_LAYERS_DEFAULT,
} from '../../godot/rendering/environment/skyReflection.js';

export const SKY_RADIANCE_UNIFORMS = {
  /** The layer array every reader samples. */
  layers: 'godotSkyLayers',
  /** The two-element `vec4` array of the shown sky's share of the ambient and its layout. */
  shown: 'godotShownSky',
  /** The energy each layer of the shown sky holds, which every read of the layer multiplies by. */
  energies: 'godotSkyEnergies',
  /** World to sky space, the inverse of `sky_rotation`'s basis. */
  rotation: 'godotSkyRotation',
} as const;

const { layers: LAYERS, shown: SHOWN, energies: ENERGIES, rotation: ROTATION } = SKY_RADIANCE_UNIFORMS;

/** Where `shownSky` holds 1 when a surface reflects the sky and 0 when it reflects nothing. */
const SHOWN_REFLECTION = 5;

/**
 * The array a reader samples the layers through. three never uploads it, as its version stays 0
 * (three r187 `WebGLTextures.js:653`), and binds whatever handle it holds on a renderer: the array
 * of the sky shown last, or three's empty array.
 */
const skyLayersSlot = installedSlot(LAYERS, THREE.DataArrayTexture);

/** The shown sky's values, one buffer each material reads by reference (three r187 `UniformsUtils.js:43`). */
const shownSky = installedOr(SHOWN, Float32Array, () => Float32Array.of(1, 1, 1, 0, 0, 0, 0, 0));

/** The energy each layer of the shown sky holds, read as `shownSky` is. 0 while no sky shows. */
export const skyEnergies = installedOr(
  ENERGIES,
  Float32Array,
  () => new Float32Array(SKY_ROUGHNESS_LAYERS_DEFAULT)
);

const IDENTITY_BASIS = Float32Array.of(1, 0, 0, 0, 1, 0, 0, 0, 1);

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
uniform float ${ENERGIES}[ ${SKY_ROUGHNESS_LAYERS_DEFAULT} ];
uniform mat3 ${ROTATION};
#define GODOT_SKY_CONTRIBUTION ${SHOWN}[ 0 ].x
#define GODOT_SKY_BORDER_SIZE ${SHOWN}[ 0 ].y
#define GODOT_SKY_DERIVATIVE_SCALE ${SHOWN}[ 0 ].z
#define GODOT_SKY_REFLECTION ${SHOWN}[ 1 ].y
${OCTMAP_GLSL}
// The mip whose texels span the octmap distance the direction moves across a pixel (oct_inc.glsl:43-51).
// The array's last level caps it, as Godot's texture does.
float godotSkyLod( const in vec3 direction ) {
	vec3 directionDdx = dFdx( direction );
	vec3 directionDdy = dFdy( direction );
	float texelsSqr = max( dot( directionDdx, directionDdx ), dot( directionDdy, directionDdy ) ) * GODOT_SKY_DERIVATIVE_SCALE;
	return 0.25 * log2( texelsSqr + 1e-6 );
}

// Radiance layer \`layer\` at the octmap texel \`uv\`, at mip \`lod\`, at the energy that layer was baked at, as
// Godot bakes it into each layer. A layer past the last reads the last.
vec3 godotSkyRead( const in vec2 uv, const in float layer, const in float lod ) {
	float energy = ${ENERGIES}[ min( int( layer + 0.5 ), ${MAX_ROUGHNESS_LOD} ) ];
	return textureLod( ${LAYERS}, vec3( uv, layer ), lod ).rgb * energy;
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
    [ENERGIES]: { value: skyEnergies },
    [ROTATION]: { value: skyRotation },
  };
}

/**
 * A sky's baked layers on one renderer, in an array of their own as Godot keeps a radiance texture
 * per sky (`servers/rendering/renderer_rd/environment/sky.h:251`). The sky's environment owns the
 * array, so skies that take turns in one frame bake and upload nothing more.
 */
export class SkyRadiance {
  private readonly toSky: ArrayLike<number>;

  /** `rotation` is `sky_rotation` as three's Euler. */
  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly layers: SkyLayers,
    rotation: THREE.Euler
  ) {
    this.toSky = worldToSky(rotation, new THREE.Matrix3()).elements;
  }

  /** Points every reader at this array, with each layer read at its entry of `energies` or the last. */
  show(contribution: number, reflects: boolean, energies: readonly number[]): void {
    const { borderSize, pixelSize } = this.layers.layout;
    shownSky[0] = contribution;
    shownSky[1] = borderSize;
    // One over `vec3_to_oct_lod`'s `pixel_size_sqr` (`oct_inc.glsl:46`), so a fragment multiplies.
    shownSky[2] = 1 / (4 * pixelSize * pixelSize);
    shownSky[SHOWN_REFLECTION] = reflects ? 1 : 0;
    skyEnergies.set(energies);
    skyEnergies.fill(energies.at(-1)!, energies.length);
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
  skyEnergies.fill(0);
  skyRotation.set(IDENTITY_BASIS);
}

/** The layer array `renderer` reads now, which changes with each sky shown. */
export function shownLayers(renderer: THREE.WebGLRenderer): WebGLTexture | undefined {
  return handleOf(renderer, skyLayersSlot).__webglTexture;
}
