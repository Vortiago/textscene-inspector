/**
 * The vertex stage a StandardMaterial3D gives a particle emitter's instances in three's programs:
 * each instance's colour multiplied into COLOR (`scene_forward_clustered.glsl:309,326`), and the
 * flipbook `_update_shader` writes for a PARTICLES billboard (`material.cpp:1340-1350`). The
 * billboard itself is every instanced draw's (`surfaceBillboard.ts`).
 */

import * as THREE from 'three';
import { composeInjections, type ProgramInjection } from '../materialProgramInputs';
import { editedProgram, type TextEdit } from '../shaderPatch/chunkPatch';
import { readsUv1 } from './mapUvChannel';
import { afterVertexColor, VERTEX_COLOR_CHUNK } from './godotVertexColor';
import type { StandardMaterialBag } from '../../resources/materials/standardmaterial3d/materialBag';
import { BillboardMode } from '../../godot/rendering/materials/billboardMode';
import { bagForms } from './bagForms';
import { withDepthInjection } from './depthInjections';
import { INSTANCE_CUSTOM, MAIN_CHUNK, UV_CHUNK } from '../surfaceBillboard';
import { PARTICLE_COLOR_ATTRIBUTE, type ParticleDraw } from './godotParticles';

/**
 * The flipbook cell of `material.cpp:1340-1350`, in Godot's top-down V. A map's coordinate here is
 * three's, which samples Godot's `v` at `1 - v` (`godot/math/uv.ts`), and already carries
 * `uv1_scale`, as Godot's UV does when the cell is cut.
 */
const PARTICLE_FRAME = /* glsl */ `vec2 godotParticleFrame( vec2 uv ) {
	float h_frames = float( GODOT_PARTICLE_H_FRAMES );
	float v_frames = float( GODOT_PARTICLE_V_FRAMES );
	float particle_total_frames = float( GODOT_PARTICLE_H_FRAMES * GODOT_PARTICLE_V_FRAMES );
	float particle_frame = floor( ${INSTANCE_CUSTOM}.z * particle_total_frames );
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

function frameDefines({ anim }: ParticleDraw): string {
  const defines = [
    `#define GODOT_PARTICLE_H_FRAMES ${anim.hFrames}`,
    `#define GODOT_PARTICLE_V_FRAMES ${anim.vFrames}`,
  ];
  if (anim.loop) defines.push('#define GODOT_PARTICLE_ANIM_LOOP');
  return defines.join('\n');
}

/** Whether `draw` cuts the flipbook, which only BILLBOARD_PARTICLES does (`material.cpp:1340`). */
function cutsFrames(draw: ParticleDraw): boolean {
  return draw.billboard.mode === BillboardMode.BILLBOARD_PARTICLES;
}

/**
 * What a program compiles with to draw `draw`'s instances. Each edit lands only where its chunk is:
 * the depth programs read no colour. The billboard declares the custom data the flipbook reads
 * (`surfaceBillboard.ts`).
 */
function particleInjection(draw: ParticleDraw, cacheKey: string): ProgramInjection {
  return {
    cacheKey,
    onBeforeCompile(shader) {
      const declarations = [`attribute vec4 ${PARTICLE_COLOR_ATTRIBUTE};`];
      const vertex: TextEdit[] = [];
      if (shader.vertexShader.includes(VERTEX_COLOR_CHUNK)) vertex.push(PARTICLE_COLOR);
      if (cutsFrames(draw)) {
        declarations.push(frameDefines(draw), PARTICLE_FRAME);
        vertex.push({ three: UV_CHUNK, godot: frameCuts(this) });
      }
      // Before `main`, for the reason the billboard's declarations are (`surfaceBillboard.ts`).
      vertex.push({ three: MAIN_CHUNK, godot: `${declarations.join('\n')}\n${MAIN_CHUNK}` });
      editedProgram(shader, { vertex }, 'particle draw');
    },
  };
}

/** Each draw's injection by its cache key, so every bag with one draw compiles one program. */
const injections = new Map<string, ProgramInjection>();

function injectionOf(draw: ParticleDraw): ProgramInjection {
  const { anim } = draw;
  const key = cutsFrames(draw)
    ? `godot-particles:frames:${anim.hFrames}:${anim.vFrames}:${anim.loop}`
    : 'godot-particles';
  let injection = injections.get(key);
  if (!injection) {
    injection = particleInjection(draw, key);
    injections.set(key, injection);
  }
  return injection;
}

/** Each bag's particle forms, filled only by `withParticleDraw`. */
const particleForms = bagForms();

/**
 * `bag` as a material for the instances of a particle emitter that draws `draw`. Its shadow draws
 * them alike: the colour multiplies the vertex colour the cut reads.
 */
export function withParticleDraw(bag: StandardMaterialBag, draw: ParticleDraw): StandardMaterialBag {
  const injection = injectionOf(draw);
  return particleForms(bag, injection.cacheKey, () => ({
    ...bag,
    props: { ...bag.props, userData: withDepthInjection(bag.props.userData ?? {}, 'afterCut', injection) },
    injection: composeInjections([bag.injection, injection]),
  }));
}
