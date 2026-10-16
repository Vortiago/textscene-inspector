/**
 * Installs Godot's fog into three's programs: every fog program blends the depth fog and the
 * volumetric fog in one step before the tone curve (`scene_forward_clustered.glsl:2988`), and the
 * cube and flat backgrounds fog the sky and the clear colour as Godot's sky shader does
 * (`sky.glsl:281-295`).
 */

import * as THREE from 'three';
import { applyChunkEdits, installChunkPatch, onChunk } from '../shaderPatch/chunkPatch.js';
import { installMergedUniform, FOG_UNIFORMS_MERGE } from '../shaderPatch/litUniform.js';
import { GODOT_FOG_PARS, GODOT_FOG_PARS_CHUNK } from './fogChunks.js';
import { fogUniformRecord } from './fogUniforms.js';
import { GODOT_SKY_VIEW_RAY } from '../sky/skyProjection.js';

const VIEW_VARYING = 'vGodotFogView';

const THREE_FOG_DEPTH = 'vFogDepth = - mvPosition.z;';

/** three's fog fragment, which the tone-curve chunk now opens with in Godot's form. */
const GODOT_FOG_BLEND = /* glsl */ `
#ifdef USE_FOG
	vec4 godotFog = godotFogAt( ${VIEW_VARYING} );
	gl_FragColor.rgb = gl_FragColor.rgb * godotFog.a + godotFog.rgb;
#endif
`;

type FogChunk =
  'fog_pars_vertex' | 'fog_vertex' | 'fog_pars_fragment' | 'fog_fragment' | 'tonemapping_fragment';

/**
 * three's fog, Godot's way: the vertex hands on its view-space position, and the fog applies ahead
 * of the tone curve. three fogs after the colour-space conversion, so its fog mixed sRGB numbers.
 */
function godotFogChunks(chunks: Record<FogChunk, string>): Record<FogChunk, string> | null {
  const edited = applyChunkEdits({ fog_vertex: chunks.fog_vertex }, [
    {
      chunk: 'fog_vertex',
      three: THREE_FOG_DEPTH,
      godot: `${THREE_FOG_DEPTH}\n\t${VIEW_VARYING} = mvPosition.xyz;`,
    },
  ]);
  if (edited === null) return null;
  return {
    fog_pars_vertex: `${chunks.fog_pars_vertex}\n#ifdef USE_FOG\n\tvarying vec3 ${VIEW_VARYING};\n#endif\n`,
    fog_vertex: edited.fog_vertex,
    fog_pars_fragment: `${chunks.fog_pars_fragment}\n#ifdef USE_FOG\n\tvarying vec3 ${VIEW_VARYING};\n\t#include <${GODOT_FOG_PARS_CHUNK}>\n#endif\n`,
    fog_fragment: '',
    // A bundler may strip a chunk's last newline, which would join two directives on one line.
    tonemapping_fragment: `${GODOT_FOG_BLEND}\n${chunks.tonemapping_fragment}`,
  };
}

const THREE_BACKGROUND_TONE_CURVE = '\t#include <tonemapping_fragment>';

/** three's cube background, fogged after its intensity, as Godot's sky is after its brightness. */
const fogBackgroundCube = onChunk('backgroundCube_frag', (shader) => {
  const fogged = applyChunkEdits({ backgroundCube_frag: shader }, [
    {
      chunk: 'backgroundCube_frag',
      three: THREE_BACKGROUND_TONE_CURVE,
      godot: `\tgl_FragColor.rgb = godotSkyFog( gl_FragColor.rgb, vWorldDirection );\n${THREE_BACKGROUND_TONE_CURVE}`,
    },
  ]);
  return fogged && `#include <${GODOT_FOG_PARS_CHUNK}>\n${fogged.backgroundCube_frag}`;
});

/** three's flat background vertex, which hands on the world direction of each pixel's view ray. */
const THREE_PLANE_POSITION = 'gl_Position = vec4( position.xy, 1.0, 1.0 );';

/** three's flat background, a colour background, fogged after its intensity as the cube is. */
function fogBackgroundPlane(chunks: Record<'background_vert' | 'background_frag', string>) {
  const fogged = applyChunkEdits(chunks, [
    {
      chunk: 'background_vert',
      three: THREE_PLANE_POSITION,
      godot: /* glsl */ `${THREE_PLANE_POSITION}
	vWorldDirection = normalize( ( vec4( ${GODOT_SKY_VIEW_RAY}, 0.0 ) * viewMatrix ).xyz );`,
    },
    {
      chunk: 'background_frag',
      three: THREE_BACKGROUND_TONE_CURVE,
      godot: `\tgl_FragColor.rgb = godotSkyFog( gl_FragColor.rgb, vWorldDirection );\n${THREE_BACKGROUND_TONE_CURVE}`,
    },
  ]);
  return (
    fogged && {
      background_vert: `varying vec3 vWorldDirection;\n${fogged.background_vert}`,
      background_frag: `#include <${GODOT_FOG_PARS_CHUNK}>\nvarying vec3 vWorldDirection;\n${fogged.background_frag}`,
    }
  );
}

/** three's cube background shader (r186 `ShaderLib.js:231-243`), which its types leave optional. */
function backgroundCube(): THREE.ShaderLibShader {
  return THREE.ShaderLib.backgroundCube!;
}

/** three's flat background shader (r186 `ShaderLib.js:218-229`), which its types leave optional. */
function backgroundPlane(): THREE.ShaderLibShader {
  return THREE.ShaderLib.background!;
}

/**
 * Patches three's fog chunks and cube background for every program compiled after the call, and
 * gives them the shared uniforms. three reads `ShaderLib.backgroundCube` when a renderer first
 * draws a cube background. A three release that rewrites a replaced line keeps its own chunks, and
 * `fogComposite.test.ts` fails on that release. A second call changes nothing.
 */
export function installFogComposite(): void {
  Object.assign(THREE.ShaderChunk, { [GODOT_FOG_PARS_CHUNK]: GODOT_FOG_PARS });
  installChunkPatch({
    names: ['fog_pars_vertex', 'fog_vertex', 'fog_pars_fragment', 'fog_fragment', 'tonemapping_fragment'],
    isApplied: (chunks) => chunks.fog_vertex.includes(VIEW_VARYING),
    apply: godotFogChunks,
    missing: `fog_vertex has no ${THREE_FOG_DEPTH}`,
  });
  const isBackgroundFogged = installChunkPatch({
    names: ['backgroundCube_frag'],
    isApplied: (chunks) => chunks.backgroundCube_frag.includes('godotSkyFog'),
    apply: fogBackgroundCube,
    missing: `backgroundCube_frag has no ${THREE_BACKGROUND_TONE_CURVE.trim()}`,
  });
  if (isBackgroundFogged) backgroundCube().fragmentShader = THREE.ShaderChunk.backgroundCube_frag;
  const isPlaneFogged = installChunkPatch({
    names: ['background_vert', 'background_frag'],
    isApplied: (chunks) => chunks.background_frag.includes('godotSkyFog'),
    apply: fogBackgroundPlane,
    missing: `background_vert has no ${THREE_PLANE_POSITION}`,
  });
  if (isPlaneFogged) {
    backgroundPlane().vertexShader = THREE.ShaderChunk.background_vert;
    backgroundPlane().fragmentShader = THREE.ShaderChunk.background_frag;
  }
  for (const [name, uniform] of Object.entries(fogUniformRecord())) {
    installMergedUniform(FOG_UNIFORMS_MERGE, name, uniform.value);
    backgroundCube().uniforms[name] = { value: uniform.value };
    backgroundPlane().uniforms[name] = { value: uniform.value };
  }
}
