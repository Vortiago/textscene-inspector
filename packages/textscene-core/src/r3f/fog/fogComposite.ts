/**
 * Installs Godot's fog into three's programs: every fog program blends the depth fog and the
 * volumetric fog in one step before the tone curve (`scene_forward_clustered.glsl:2988`), and the
 * cube and flat backgrounds fog the sky and the clear colour as Godot's sky shader does
 * (`sky.glsl:281-295`).
 */

import * as THREE from 'three';
import { installChunkEdits } from '../shaderPatch/chunkPatch.js';
import { installMergedUniform, FOG_UNIFORMS_MERGE } from '../shaderPatch/litUniform.js';
import { GODOT_FOG_PARS, GODOT_FOG_PARS_CHUNK } from './fogChunks.js';
import { fogUniformRecord } from './fogUniforms.js';
import { GODOT_SKY_VIEW_RAY } from '../sky/skyProjection.js';
import { backgroundCube, backgroundPlane } from '../shaderPatch/backgroundPrograms.js';

const VIEW_VARYING = 'vGodotFogView';

const THREE_FOG_DEPTH = 'vFogDepth = - mvPosition.z;';

/** three's fog fragment, which the tone-curve chunk now opens with in Godot's form. */
const GODOT_FOG_BLEND = /* glsl */ `
#ifdef USE_FOG
	vec4 godotFog = godotFogAt( ${VIEW_VARYING} );
	gl_FragColor.rgb = gl_FragColor.rgb * godotFog.a + godotFog.rgb;
#endif
`;

/**
 * three's fog, Godot's way: the vertex hands on its view-space position, and the fog applies ahead
 * of the tone curve. three fogs after the colour-space conversion, so its fog mixed sRGB numbers.
 */
function installGodotFog(): void {
  installChunkEdits({
    edits: [
      {
        chunk: 'fog_vertex',
        three: THREE_FOG_DEPTH,
        godot: `${THREE_FOG_DEPTH}\n\t${VIEW_VARYING} = mvPosition.xyz;`,
      },
      {
        chunk: 'fog_fragment',
        three: '#ifdef USE_FOG',
        until: 'fogFactor );\n#endif',
        godot: '',
      },
    ],
    mark: VIEW_VARYING,
    patch: 'fog',
    // A bundler may strip a chunk's last newline, which would join two directives on one line.
    prepend: { tonemapping_fragment: `${GODOT_FOG_BLEND}\n` },
    append: {
      fog_pars_vertex: `\n#ifdef USE_FOG\n\tvarying vec3 ${VIEW_VARYING};\n#endif\n`,
      fog_pars_fragment: `\n#ifdef USE_FOG\n\tvarying vec3 ${VIEW_VARYING};\n\t#include <${GODOT_FOG_PARS_CHUNK}>\n#endif\n`,
    },
  });
}

/** three's background tone curve line, ahead of which the sky fog and the debanding go. */
export const THREE_BACKGROUND_TONE_CURVE = '\t#include <tonemapping_fragment>';

/** The sky fog's function, which marks a background chunk that holds the fog. */
export const SKY_FOG = 'godotSkyFog';

const GODOT_BACKGROUND_FOG = `\tgl_FragColor.rgb = ${SKY_FOG}( gl_FragColor.rgb, vWorldDirection );\n${THREE_BACKGROUND_TONE_CURVE}`;

/** three's cube background, fogged after its intensity, as Godot's sky is after its brightness. */
function installCubeBackgroundFog(): void {
  const isFogged = installChunkEdits({
    edits: [
      { chunk: 'backgroundCube_frag', three: THREE_BACKGROUND_TONE_CURVE, godot: GODOT_BACKGROUND_FOG },
    ],
    mark: SKY_FOG,
    patch: 'cube background fog',
    prepend: { backgroundCube_frag: `#include <${GODOT_FOG_PARS_CHUNK}>\n` },
  });
  if (isFogged) backgroundCube().fragmentShader = THREE.ShaderChunk.backgroundCube_frag;
}

/** three's flat background vertex, which hands on the world direction of each pixel's view ray. */
const THREE_PLANE_POSITION = 'gl_Position = vec4( position.xy, 1.0, 1.0 );';

/** three's flat background, a colour background, fogged after its intensity as the cube is. */
function installPlaneBackgroundFog(): void {
  const isFogged = installChunkEdits({
    edits: [
      {
        chunk: 'background_vert',
        three: THREE_PLANE_POSITION,
        godot: /* glsl */ `${THREE_PLANE_POSITION}
	vWorldDirection = normalize( ( vec4( ${GODOT_SKY_VIEW_RAY}, 0.0 ) * viewMatrix ).xyz );`,
      },
      { chunk: 'background_frag', three: THREE_BACKGROUND_TONE_CURVE, godot: GODOT_BACKGROUND_FOG },
    ],
    mark: SKY_FOG,
    patch: 'flat background fog',
    prepend: {
      background_vert: 'varying vec3 vWorldDirection;\n',
      background_frag: `#include <${GODOT_FOG_PARS_CHUNK}>\nvarying vec3 vWorldDirection;\n`,
    },
  });
  if (!isFogged) return;
  backgroundPlane().vertexShader = THREE.ShaderChunk.background_vert;
  backgroundPlane().fragmentShader = THREE.ShaderChunk.background_frag;
}

/**
 * Patches three's fog chunks and both backgrounds for every program compiled after the call, and
 * gives them the shared uniforms. three reads `ShaderLib.backgroundCube` when a renderer first
 * draws a cube background. A three release that rewrites a replaced line keeps its own chunks, and
 * `fogComposite.test.ts` fails on that release. A second call changes nothing.
 */
export function installFogComposite(): void {
  Object.assign(THREE.ShaderChunk, { [GODOT_FOG_PARS_CHUNK]: GODOT_FOG_PARS });
  installGodotFog();
  installCubeBackgroundFog();
  installPlaneBackgroundFog();
  for (const [name, uniform] of Object.entries(fogUniformRecord())) {
    installMergedUniform(FOG_UNIFORMS_MERGE, name, uniform.value);
    backgroundCube().uniforms[name] = { value: uniform.value };
    backgroundPlane().uniforms[name] = { value: uniform.value };
  }
}
