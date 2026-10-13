/**
 * How every surface and the background composite Godot's volumetric fog: three's fog chunks and
 * background shader, patched to sample the froxel volume, and the uniforms they read. Godot blends
 * the depth fog and the volume in one step before the tone curve
 * (`forward_clustered/scene_forward_clustered.glsl:1485-1520,2988`, `environment/sky.glsl:287-294`).
 */

import * as THREE from 'three';
import { applyChunkEdits, installChunkPatch, onChunk } from '../shaderPatch/chunkPatch.js';
import { installedUniformValue } from '../shaderPatch/litUniform.js';

/**
 * The volume the fog pass integrates into. `cloneUniforms` clones a texture for each material
 * (three r186 `UniformsUtils.js:28-39`) and nulls a render target's, so this texture is no render
 * target's in three's eyes, and a clone of it is itself. Until a pass draws it, three binds its
 * empty 3D texture in its place (`WebGLState.js:952`).
 */
export class VolumetricFogVolume extends THREE.Data3DTexture {
  constructor() {
    super(null, 1, 1, 1);
    this.name = 'VolumetricFogVolume';
    this.format = THREE.RGBAFormat;
    this.type = THREE.HalfFloatType;
    this.minFilter = THREE.LinearFilter;
    this.magFilter = THREE.LinearFilter;
    this.generateMipmaps = false;
  }

  override clone(): this {
    return this;
  }
}

const VOLUME = 'volumetricFogVolume';
const LOOKUP = 'volumetricFogLookup';
const VIEWPORT = 'volumetricFogViewport';

/**
 * The values every fog program and the background read, one object each, so every material's
 * clone reads the same one (a typed array passes `cloneUniforms` by reference). `lookup` holds the
 * inverse fog length, 0 when the render has no volume, then the inverse detail spread, the sky
 * affect and 1 for legacy blending. `viewport` holds the render's origin and inverse size in
 * pixels. Written only by the fog pass, before each render of a scene with volumetric fog, and
 * cleared after it. A reloaded module takes the values the programs already read.
 */
export const volumetricFogUniforms = {
  volume: (installedUniformValue(VOLUME) as VolumetricFogVolume | undefined) ?? new VolumetricFogVolume(),
  lookup: (installedUniformValue(LOOKUP) as Float32Array | undefined) ?? new Float32Array(4),
  viewport: (installedUniformValue(VIEWPORT) as Float32Array | undefined) ?? new Float32Array(4),
};

/** The volume's sample at the fragment, for a surface at `viewDepth` (`scene_forward_clustered.glsl:1091-1099`). */
const VOLUMETRIC_FOG_PARS = /* glsl */ `
uniform highp sampler3D ${VOLUME};
uniform vec4 ${LOOKUP};
uniform vec4 ${VIEWPORT};

vec2 volumetricFogScreenUv() {
	return ( gl_FragCoord.xy - ${VIEWPORT}.xy ) * ${VIEWPORT}.zw;
}

vec4 volumetricFogAtDepth( float viewDepth ) {
	vec3 position = vec3( volumetricFogScreenUv(), viewDepth * ${LOOKUP}.x );
	if ( position.z < 0.0 ) return vec4( 0.0, 0.0, 0.0, 1.0 );
	if ( position.z < 1.0 ) position.z = pow( position.z, ${LOOKUP}.y );
	return texture( ${VOLUME}, position );
}
`;

/** The background under the volume's far side, scaled by the sky affect (`sky.glsl:287-294`). */
const VOLUMETRIC_FOG_SKY = /* glsl */ `
	if ( ${LOOKUP}.x > 0.0 ) {
		vec4 skyFog = texture( ${VOLUME}, vec3( volumetricFogScreenUv(), 1.0 ) );
		if ( ${LOOKUP}.w > 0.5 ) {
			gl_FragColor.rgb = mix( gl_FragColor.rgb, skyFog.rgb, ( 1.0 - skyFog.a ) * ${LOOKUP}.z );
		} else {
			gl_FragColor.rgb = mix( gl_FragColor.rgb, gl_FragColor.rgb * skyFog.a + skyFog.rgb, ${LOOKUP}.z );
		}
	}
`;

/** The chunks a shader includes to read the volume, and to fog the background. */
export const VOLUMETRIC_FOG_PARS_CHUNK = 'volumetric_fog_pars_fragment';
export const VOLUMETRIC_FOG_SKY_CHUNK = 'volumetric_fog_sky_fragment';

/**
 * The depth fog premultiplied, with its transmittance, then blended with the volume. Legacy
 * blending is Godot 4.0's composite. Its alpha equals the current one.
 */
const GODOT_FOG = /* glsl */ `
#ifdef USE_FOG

	#include <${VOLUMETRIC_FOG_PARS_CHUNK}>

	vec3 godotFog( vec3 color, float fogFactor ) {
		vec4 fog = vec4( fogColor * fogFactor, 1.0 - fogFactor );
		if ( ${LOOKUP}.x > 0.0 ) {
			vec4 volume = volumetricFogAtDepth( vFogDepth );
			vec3 rgb = ${LOOKUP}.w > 0.5 ? mix( volume.rgb, fog.rgb, volume.a ) : fog.rgb * volume.a + volume.rgb;
			fog = vec4( rgb, fog.a * volume.a );
		}
		return color * fog.a + fog.rgb;
	}

#endif
`;

const THREE_FOG_BLEND = 'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );';
const GODOT_FOG_BLEND = 'gl_FragColor.rgb = godotFog( gl_FragColor.rgb, fogFactor );';

type FogChunk = 'fog_pars_fragment' | 'fog_fragment' | 'tonemapping_fragment';

/**
 * three's fog fragment, moved ahead of the tone curve and blending Godot's way. three fogs after the
 * colour-space conversion, so its fog colour mixed with sRGB numbers.
 */
function moveFogAheadOfToneCurve(chunks: Record<FogChunk, string>): Record<FogChunk, string> | null {
  const blended = applyChunkEdits({ fog_fragment: chunks.fog_fragment }, [
    { chunk: 'fog_fragment', three: THREE_FOG_BLEND, godot: GODOT_FOG_BLEND },
  ]);
  if (blended === null) return null;
  return {
    fog_pars_fragment: `${chunks.fog_pars_fragment}\n${GODOT_FOG}`,
    fog_fragment: '',
    // A bundler may strip a chunk's last newline, which would join two directives on one line.
    tonemapping_fragment: `${blended.fog_fragment}\n${chunks.tonemapping_fragment}`,
  };
}

const THREE_BACKGROUND_TONE_CURVE = '\t#include <tonemapping_fragment>';

/** three's cube background, fogged after its intensity, as Godot's sky is after its brightness. */
const fogBackgroundCube = onChunk('backgroundCube_frag', (shader) => {
  const fogged = applyChunkEdits({ backgroundCube_frag: shader }, [
    {
      chunk: 'backgroundCube_frag',
      three: THREE_BACKGROUND_TONE_CURVE,
      godot: `\t#include <${VOLUMETRIC_FOG_SKY_CHUNK}>\n${THREE_BACKGROUND_TONE_CURVE}`,
    },
  ]);
  return fogged && `#include <${VOLUMETRIC_FOG_PARS_CHUNK}>\n${fogged.backgroundCube_frag}`;
});

/** three's cube background shader (r186 `ShaderLib.js:231-243`), which its types leave optional. */
function backgroundCube(): THREE.ShaderLibShader {
  return THREE.ShaderLib.backgroundCube!;
}

/** The uniforms that read the volume, for a shader that includes `VOLUMETRIC_FOG_PARS_CHUNK`. */
export function volumetricFogUniformRecord(): Record<string, THREE.IUniform> {
  return {
    [VOLUME]: { value: volumetricFogUniforms.volume },
    [LOOKUP]: { value: volumetricFogUniforms.lookup },
    [VIEWPORT]: { value: volumetricFogUniforms.viewport },
  };
}

/**
 * Gives the volume's uniforms to every built-in material that merges `UniformsLib.fog`, which only
 * fog programs do (r186 `ShaderLib.js:19-290`), and to the cube background.
 */
function installFogUniforms(): void {
  const fogShaders = Object.values(THREE.ShaderLib).filter((shader) => 'fogDensity' in shader.uniforms);
  const uniformSets = [
    ...fogShaders.map((shader) => shader.uniforms),
    THREE.UniformsLib.fog,
    backgroundCube().uniforms,
  ];
  for (const uniforms of uniformSets) Object.assign(uniforms, volumetricFogUniformRecord());
}

/**
 * Patches three's fog chunks and cube background for every program compiled after the call, and
 * gives them the shared uniforms. three reads `ShaderLib.backgroundCube` when a renderer first
 * draws a cube background. A three release that rewrites a replaced line keeps its own chunks, and
 * `fogComposite.test.ts` fails on that release. A second call changes nothing.
 */
export function installVolumetricFogComposite(): void {
  Object.assign(THREE.ShaderChunk, {
    [VOLUMETRIC_FOG_PARS_CHUNK]: VOLUMETRIC_FOG_PARS,
    [VOLUMETRIC_FOG_SKY_CHUNK]: VOLUMETRIC_FOG_SKY,
  });
  installChunkPatch({
    names: ['fog_pars_fragment', 'fog_fragment', 'tonemapping_fragment'],
    isApplied: (chunks) => chunks.fog_pars_fragment.includes('godotFog'),
    apply: moveFogAheadOfToneCurve,
    missing: `fog_fragment has no ${THREE_FOG_BLEND}`,
  });
  const isBackgroundFogged = installChunkPatch({
    names: ['backgroundCube_frag'],
    isApplied: (chunks) => chunks.backgroundCube_frag.includes(VOLUMETRIC_FOG_SKY_CHUNK),
    apply: fogBackgroundCube,
    missing: `backgroundCube_frag has no ${THREE_BACKGROUND_TONE_CURVE.trim()}`,
  });
  if (isBackgroundFogged) backgroundCube().fragmentShader = THREE.ShaderChunk.backgroundCube_frag;
  installFogUniforms();
}
