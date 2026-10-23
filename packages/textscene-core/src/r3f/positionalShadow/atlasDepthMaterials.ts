/**
 * The depth materials the positional shadows draw their casters into the atlas with: three's depth
 * program, which also writes the depth into the atlas's colour for the blocker search. A spot light
 * draws with it as three projects, and an area light bends each vertex onto one paraboloid facing
 * the light's -Z, as Godot's depth pass does (4.7.2 `scene_forward_clustered.glsl:503-518`, `:3127`).
 */

import * as THREE from 'three';
import { composeInjections, injectProgram, type ProgramInjection } from '../materialProgramInputs.js';
import { editedProgram } from '../shaderPatch/chunkPatch.js';

/**
 * The window depth as the atlas's 16-bit depth stores it, clamped as the depth buffer clamps it,
 * high byte in red and low byte in green. A lit draw compares the depth texture, so it reads the
 * raw depth for its blocker search from this colour (`positionalShadowLookup.ts`).
 */
export const PACK_ATLAS_DEPTH = /* glsl */ `
vec2 packAtlasDepth( float depth ) {
	float bits = floor( clamp( depth, 0.0, 1.0 ) * 65535.0 + 0.5 );
	float high = floor( bits / 256.0 );
	return vec2( high, bits - high * 256.0 ) / 255.0;
}`;

const ATLAS_DEPTH: ProgramInjection = {
  cacheKey: 'godot-atlas-depth',
  onBeforeCompile(shader) {
    editedProgram(
      shader,
      {
        fragment: [
          { three: 'void main() {', godot: `${PACK_ATLAS_DEPTH}\nvoid main() {` },
          // The last `#endif` of three's depth packing ends `main`, where the atlas colour is written.
          {
            three: '#endif\n}',
            godot: '#endif\n\tgl_FragColor = vec4( packAtlasDepth( gl_FragCoord.z ), 0.0, 1.0 );\n}\n',
          },
        ],
      },
      'atlas depth'
    );
  },
};

/**
 * Godot's bend, in the light's view space. `paraboloidSide` keeps the unbent z, so a triangle
 * behind the light draws nothing. The camera's projection then maps the distance to the light onto
 * the depth range (`ParaboloidCamera`).
 */
const PARABOLOID_VERTEX = /* glsl */ `#include <project_vertex>
vec3 paraboloidVertex = mvPosition.xyz;
paraboloidSide = mvPosition.z;
float paraboloidDistance = length( paraboloidVertex );
paraboloidVertex = normalize( paraboloidVertex );
paraboloidVertex.xy /= 1.0 - paraboloidVertex.z;
gl_Position = projectionMatrix * vec4( paraboloidVertex.xy, paraboloidDistance, 1.0 );`;

const PARABOLOID_BEND: ProgramInjection = {
  cacheKey: 'godot-paraboloid-depth',
  onBeforeCompile(shader) {
    const declareSide = { three: 'void main() {', godot: 'varying float paraboloidSide;\nvoid main() {' };
    editedProgram(
      shader,
      {
        vertex: [declareSide, { three: '#include <project_vertex>', godot: PARABOLOID_VERTEX }],
        fragment: [
          declareSide,
          {
            three: '#include <clipping_planes_fragment>',
            godot: '#include <clipping_planes_fragment>\n\tif ( paraboloidSide > 0.0 ) discard;',
          },
        ],
      },
      'paraboloid depth'
    );
  },
};

/** A depth material whose program a copy that cuts a surface's alpha keeps (`surfaceDepthMaterial.ts`). */
abstract class InjectedDepthMaterial extends THREE.MeshDepthMaterial {
  constructor(readonly depthInjection: ProgramInjection) {
    super();
    injectProgram(this, depthInjection);
  }
}

export class AtlasDepthMaterial extends InjectedDepthMaterial {
  constructor() {
    super(ATLAS_DEPTH);
  }
}

export class ParaboloidDepthMaterial extends InjectedDepthMaterial {
  constructor() {
    super(composeInjections([PARABOLOID_BEND, ATLAS_DEPTH])!);
  }
}
