import * as THREE from 'three';
import { installChunkEdits } from '../shaderPatch/chunkPatch.js';
import { installMergedUniform, FOG_UNIFORMS_MERGE } from '../shaderPatch/litUniform.js';
import { GODOT_FOG_PARS, GODOT_FOG_PARS_CHUNK } from './fogChunks.js';
import { fogUniformRecord } from './fogUniforms.js';
import { skyRadianceUniforms } from '../sky/skyRadiance.js';
import { GODOT_SKY_VIEW_RAY } from '../sky/skyProjection.js';

const VIEW_VARYING = 'vGodotFogView';

// three's types leave `ShaderLib.background` optional, though r187 ships it (`ShaderLib.js:218`).
const backgroundPlane = (): THREE.ShaderLibShader => THREE.ShaderLib.background!;

const THREE_FOG_DEPTH = 'vFogDepth = - mvPosition.z;';

/** three's fog fragment, which the tone-curve chunk now opens with in Godot's form. */
const GODOT_FOG_BLEND = /* glsl */ `
#ifdef USE_FOG
	vec4 godotFog = godotFogAt( ${VIEW_VARYING} );
	gl_FragColor.rgb = gl_FragColor.rgb * godotFog.a + godotFog.rgb;
#endif
`;

/** Fog ahead of the tone curve, not after three's colour-space step (scene_forward_clustered.glsl:2988). */
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

/** three's background tone curve line, ahead of which the sky fog goes. */
const THREE_BACKGROUND_TONE_CURVE = '\t#include <tonemapping_fragment>';

/** The sky fog's function, which marks a background chunk that holds the fog. */
const SKY_FOG = 'godotSkyFog';

const GODOT_BACKGROUND_FOG = `\tgl_FragColor.rgb = ${SKY_FOG}( gl_FragColor.rgb, vWorldDirection );\n${THREE_BACKGROUND_TONE_CURVE}`;

/** three's flat background vertex, which hands on the world direction of each pixel's view ray. */
const THREE_PLANE_POSITION = 'gl_Position = vec4( position.xy, 1.0, 1.0 );';

/** The colour background, fogged after its intensity as Godot's sky is (sky.glsl:281-295). */
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

/** Patches three's fog and flat background programs compiled after the call. A second call does nothing. */
export function installFogComposite(): void {
  Object.assign(THREE.ShaderChunk, { [GODOT_FOG_PARS_CHUNK]: GODOT_FOG_PARS });
  installGodotFog();
  installPlaneBackgroundFog();
  for (const [name, uniform] of Object.entries({ ...fogUniformRecord(), ...skyRadianceUniforms() })) {
    installMergedUniform(FOG_UNIFORMS_MERGE, name, uniform.value);
    backgroundPlane().uniforms[name] = { value: uniform.value };
  }
}
