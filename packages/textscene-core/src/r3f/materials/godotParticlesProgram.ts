/**
 * The vertex stage a StandardMaterial3D gives a particle emitter's instances in three's programs:
 * each instance's colour multiplied into COLOR (`scene_forward_clustered.glsl:309,326`), and the
 * billboard and flipbook `_update_shader` writes for the material's `billboard_mode`
 * (`material.cpp:1260-1351`), which Godot applies to each instance about its own origin.
 */

import * as THREE from 'three';
import { composeInjections, type ProgramInjection } from '../materialProgramInputs';
import { editedProgram, rewrittenShader, type TextEdit } from '../shaderPatch/chunkPatch';
import { readsUv1 } from './mapUvChannel';
import { afterVertexColor, VERTEX_COLOR_CHUNK } from './godotVertexColor';
import type { StandardMaterialBag } from '../../resources/materials/standardmaterial3d/materialBag';
import { BillboardMode } from '../../godot/rendering/materials/billboardMode';
import { bagForms } from './bagForms';

import {
  MAIN_CAMERA_WORLD,
  PARTICLE_COLOR_ATTRIBUTE,
  PARTICLE_CUSTOM_ATTRIBUTE,
  PARTICLE_DRAW_KEY,
  PASS_CAMERA_WORLD,
  type ParticleDraw,
} from './godotParticles';

const UV_CHUNK = '#include <uv_vertex>';
const NORMAL_CHUNK = '#include <defaultnormal_vertex>';
/** Every run of the normal chunk: a patch may run it again, and each run needs the billboard. */
const NORMAL_CHUNKS = /#include <defaultnormal_vertex>/g;

/** `INSTANCE_CUSTOM.x` turns a PARTICLES billboard about the view axis (`material.cpp:1318-1322`). */
const BILLBOARD_BASES = {
  [BillboardMode.BILLBOARD_ENABLED]: /* glsl */ `mat4 godotWorld = mat4(
		godotMainCameraWorld[ 0 ],
		godotMainCameraWorld[ 1 ],
		godotMainCameraWorld[ 2 ],
		godotModel[ 3 ] );`,
  [BillboardMode.BILLBOARD_FIXED_Y]: /* glsl */ `mat4 godotWorld = mat4(
		vec4( normalize( cross( vec3( 0.0, 1.0, 0.0 ), godotMainCameraWorld[ 2 ].xyz ) ), 0.0 ),
		vec4( 0.0, 1.0, 0.0, 0.0 ),
		vec4( normalize( cross( godotMainCameraWorld[ 0 ].xyz, vec3( 0.0, 1.0, 0.0 ) ) ), 0.0 ),
		godotModel[ 3 ] );`,
  [BillboardMode.BILLBOARD_PARTICLES]: /* glsl */ `mat4 godotWorld = mat4(
		normalize( godotPassCameraWorld[ 0 ] ),
		normalize( godotPassCameraWorld[ 1 ] ),
		normalize( godotPassCameraWorld[ 2 ] ),
		godotModel[ 3 ] );
	godotWorld = godotWorld * mat4(
		vec4( cos( particleCustom.x ), - sin( particleCustom.x ), 0.0, 0.0 ),
		vec4( sin( particleCustom.x ), cos( particleCustom.x ), 0.0, 0.0 ),
		vec4( 0.0, 0.0, 1.0, 0.0 ),
		vec4( 0.0, 0.0, 0.0, 1.0 ) );`,
} as const;

/**
 * Godot's MODEL_MATRIX for an instance is the node's times the instance's
 * (`scene_forward_clustered.glsl:341`), and the billboard replaces its basis. `billboard_keep_scale`
 * keeps that matrix's column lengths (`material.cpp:1274-1281`).
 */
function billboardWorld(mode: keyof typeof BILLBOARD_BASES): string {
  return /* glsl */ `#ifdef USE_INSTANCING
uniform mat4 godotMainCameraWorld;
uniform mat4 godotPassCameraWorld;
mat4 godotParticleBillboard() {
	mat4 godotModel = modelMatrix * instanceMatrix;
	${BILLBOARD_BASES[mode]}
	#ifdef GODOT_PARTICLE_KEEP_SCALE
		godotWorld = godotWorld * mat4(
			vec4( length( godotModel[ 0 ].xyz ), 0.0, 0.0, 0.0 ),
			vec4( 0.0, length( godotModel[ 1 ].xyz ), 0.0, 0.0 ),
			vec4( 0.0, 0.0, length( godotModel[ 2 ].xyz ), 0.0 ),
			vec4( 0.0, 0.0, 0.0, 1.0 ) );
	#endif
	return godotWorld;
}
#endif`;
}

/**
 * three multiplies `modelMatrix` after `instanceMatrix`, so the instance carries the node's inverse
 * and every chunk that reads it draws the billboard. A macro after the attribute's declaration, so
 * each later read takes the billboard. A points draw holds each particle in its vertices, at the
 * particle's origin, which a billboard about that origin leaves in place.
 */
const BILLBOARD_POSE = /* glsl */ `#ifdef USE_INSTANCING
	mat4 godotParticleWorld = godotParticleBillboard();
	mat4 godotParticleInstance = inverse( modelMatrix ) * godotParticleWorld;
	#define instanceMatrix godotParticleInstance
#endif
${UV_CHUNK}`;

/**
 * `MODELVIEW_NORMAL_MATRIX = mat3(MODELVIEW_MATRIX)` (`material.cpp:1338`), where three would turn the
 * normal by the inverse transpose.
 */
const BILLBOARD_NORMAL = /* glsl */ `${NORMAL_CHUNK}
#ifdef USE_INSTANCING
	transformedNormal = mat3( viewMatrix * godotParticleWorld ) * objectNormal;
	#ifdef FLIP_SIDED
		transformedNormal = - transformedNormal;
	#endif
#endif`;

/**
 * The flipbook cell of `material.cpp:1340-1350`, in Godot's top-down V. A map's coordinate here is
 * three's, which samples Godot's `v` at `1 - v` (`godot/math/uv.ts`), and already carries
 * `uv1_scale`, as Godot's UV does when the cell is cut.
 */
const PARTICLE_FRAME = /* glsl */ `vec2 godotParticleFrame( vec2 uv ) {
	float h_frames = float( GODOT_PARTICLE_H_FRAMES );
	float v_frames = float( GODOT_PARTICLE_V_FRAMES );
	float particle_total_frames = float( GODOT_PARTICLE_H_FRAMES * GODOT_PARTICLE_V_FRAMES );
	float particle_frame = floor( particleCustom.z * particle_total_frames );
	#ifdef GODOT_PARTICLE_ANIM_LOOP
		particle_frame = mod( particle_frame, particle_total_frames );
	#else
		particle_frame = clamp( particle_frame, 0.0, particle_total_frames - 1.0 );
	#endif
	vec2 godotUv = vec2( uv.x, 1.0 - uv.y ) / vec2( h_frames, v_frames );
	godotUv += vec2( mod( particle_frame, h_frames ) / h_frames, floor( ( particle_frame + 0.5 ) / h_frames ) / v_frames );
	return vec2( godotUv.x, 1.0 - godotUv.y );
}`;

/** Each map coordinate `uv_vertex` writes, with the define that declares it. */
const MAP_COORDINATES: readonly { define: string; uv: string }[] = Array.from(
  THREE.ShaderChunk.uv_vertex.matchAll(/#ifdef (USE_\w+)\s+(v\w+Uv) = /g),
  ([, define, uv]) => ({ define: define!, uv: uv! })
  // The lightmap reads UV2 in Godot (`scene_forward_clustered.glsl:1840`), whichever channel three binds.
).filter(({ uv }) => uv !== 'vLightMapUv');

/** The frame cut of each coordinate of `material` that reads UV1, after three writes them. */
function frameCuts(material: THREE.Material): string {
  const cuts = MAP_COORDINATES.filter(({ uv }) => readsUv1(material, uv)).map(
    ({ define, uv }) => `#ifdef ${define}\n\t${uv} = godotParticleFrame( ${uv} );\n#endif`
  );
  return `${UV_CHUNK}\n${cuts.join('\n')}`;
}

const PARTICLE_COLOR = afterVertexColor(`	vColor *= ${PARTICLE_COLOR_ATTRIBUTE};`);

function particleDefines({ billboard, anim }: ParticleDraw): string {
  const defines = [
    `#define GODOT_PARTICLE_H_FRAMES ${anim.hFrames}`,
    `#define GODOT_PARTICLE_V_FRAMES ${anim.vFrames}`,
  ];
  if (anim.loop) defines.push('#define GODOT_PARTICLE_ANIM_LOOP');
  if (billboard.keepScale) defines.push('#define GODOT_PARTICLE_KEEP_SCALE');
  return defines.join('\n');
}

/** Whether `mode` is one `_update_shader` writes a billboard for. */
function billboards(mode: number): mode is keyof typeof BILLBOARD_BASES {
  return mode in BILLBOARD_BASES;
}

/**
 * What a program compiles with to draw `draw`'s instances. Each edit lands only where its chunk is:
 * the depth programs read no colour, and only a colour program turns the normal.
 */
function particleInjection(draw: ParticleDraw, cacheKey: string): ProgramInjection {
  const { mode } = draw.billboard;
  const billboarded = billboards(mode);
  const cutsFrames = mode === BillboardMode.BILLBOARD_PARTICLES;
  return {
    cacheKey,
    onBeforeCompile(shader) {
      const declarations = [
        particleDefines(draw),
        `attribute vec4 ${PARTICLE_COLOR_ATTRIBUTE};`,
        `attribute vec4 ${PARTICLE_CUSTOM_ATTRIBUTE};`,
      ];
      const vertex: TextEdit[] = [];
      if (shader.vertexShader.includes(VERTEX_COLOR_CHUNK)) vertex.push(PARTICLE_COLOR);
      if (billboarded) {
        shader.uniforms.godotMainCameraWorld = MAIN_CAMERA_WORLD;
        shader.uniforms.godotPassCameraWorld = PASS_CAMERA_WORLD;
        declarations.push(billboardWorld(mode));
        vertex.push({ three: UV_CHUNK, godot: BILLBOARD_POSE });
      }
      if (cutsFrames) {
        declarations.push(PARTICLE_FRAME);
        vertex.push({ three: UV_CHUNK, godot: frameCuts(this) });
      }
      editedProgram(shader, { vertex }, 'particle draw');
      if (billboarded)
        shader.vertexShader = rewrittenShader(shader.vertexShader, NORMAL_CHUNKS, () => BILLBOARD_NORMAL);
      shader.vertexShader = `${declarations.join('\n')}\n${shader.vertexShader}`;
    },
  };
}

/** Each draw's injection by its cache key, so every bag with one draw compiles one program. */
const injections = new Map<string, ProgramInjection>();

function injectionOf(draw: ParticleDraw): ProgramInjection {
  const { billboard, anim } = draw;
  const key = `godot-particles:${billboard.mode}:${billboard.keepScale}:${anim.hFrames}:${anim.vFrames}:${anim.loop}`;
  let injection = injections.get(key);
  if (!injection) {
    injection = particleInjection(draw, key);
    injections.set(key, injection);
  }
  return injection;
}

/** Each bag's particle forms, filled only by `withParticleDraw`. */
const particleForms = bagForms();

/** `bag` as a material for the instances of a particle emitter that draws `draw`. */
export function withParticleDraw(bag: StandardMaterialBag, draw: ParticleDraw): StandardMaterialBag {
  const injection = injectionOf(draw);
  return particleForms(bag, injection.cacheKey, () => ({
    ...bag,
    props: { ...bag.props, userData: { ...bag.props.userData, [PARTICLE_DRAW_KEY]: injection } },
    injection: composeInjections([bag.injection, injection]),
  }));
}
