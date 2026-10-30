/**
 * The billboard of a StandardMaterial3D surface, in its programs. Godot writes it in the vertex
 * shader as a new `MODELVIEW_MATRIX` and `MODELVIEW_NORMAL_MATRIX` (`material.cpp:1260-1335`), so it
 * replaces the model basis for that surface alone and keeps the model origin. A plain draw turns
 * about its node and an instanced draw about each instance, as Godot's MODEL_MATRIX holds each.
 */

import * as THREE from 'three';
import { BillboardMode } from '../godot/rendering/materials/billboardMode';
import type { SurfaceBillboard } from '../resources/materials/standardmaterial3d/materialBag';
import { composeInjections, type ProgramInjection } from './materialProgramInputs';
import { editedProgram, rewrittenShader } from './shaderPatch/chunkPatch';
import { INSTANCE_CUSTOM_ATTRIBUTE } from './meshes/sharedInstances';
import { DRAWN_INSTANCE, DRAWN_MODEL } from './materials/nodePose';

/** The lines before `main` and at `uv_vertex`, where the billboard and the particle draw edit. */
export const MAIN_CHUNK = 'void main() {';
export const UV_CHUNK = '#include <uv_vertex>';

/**
 * Each instance's custom data, which a PARTICLES billboard turns by and the particle flipbook cuts
 * by (`godotParticlesProgram.ts`). A draw whose program does not define
 * {@link READS_INSTANCE_CUSTOM}, as a plain draw or a GridMap's, reads it as zero angle and frame.
 */
export const INSTANCE_CUSTOM = 'godotInstanceCustom';

/**
 * The define of a program whose geometry holds the custom data attribute. A declared attribute with
 * no buffer reads whatever constant the last program left at its location, not zero.
 */
export const READS_INSTANCE_CUSTOM = 'GODOT_READS_INSTANCE_CUSTOM';

const DEFAULT_NORMAL_INCLUDE = /#include <defaultnormal_vertex>/g;

/**
 * Godot's billboard turns normals by `mat3(MODELVIEW_MATRIX)` (`material.cpp:1284,1307,1338`), not
 * by its inverse transpose, so a kept non-uniform scale stretches them as it stretches the surface.
 * The unshaded parallax adds a second include, so every include turns.
 */
const BILLBOARD_NORMAL: ProgramInjection = {
  cacheKey: 'godot-billboard-normal',
  onBeforeCompile(shader) {
    const chunk = `#include <defaultnormal_vertex>
	transformedNormal = mat3( godotBillboardModelView ) * objectNormal;
	#ifdef FLIP_SIDED
		transformedNormal = - transformedNormal;
	#endif`;
    const turned = rewrittenShader(shader.vertexShader, DEFAULT_NORMAL_INCLUDE, () => chunk);
    if (turned === shader.vertexShader) {
      throw new Error(
        `expected the vertex shader of the billboard normal to hold "#include <defaultnormal_vertex>" once or more, got:\n${turned}`
      );
    }
    shader.vertexShader = turned;
  },
};

/**
 * The main camera's world matrix, which ENABLED and FIXED_Y read as `MAIN_CAM_INV_VIEW_MATRIX`, the
 * main camera even on a shadow pass (`material.cpp:1263-1264`). One value for every program, as it
 * is one camera for every draw of a render. Written only by {@link aimBillboards}.
 */
const MAIN_CAMERA_WORLD: THREE.IUniform<THREE.Matrix4> = { value: new THREE.Matrix4() };

/**
 * The world matrix of the camera this pass draws through, which PARTICLES reads as
 * `INV_VIEW_MATRIX`, a uniform in Godot too. A uniform, not `inverse( viewMatrix )`: no matrix
 * inverse per vertex. Written only by {@link aimBillboards}.
 */
const PASS_CAMERA_WORLD: THREE.IUniform<THREE.Matrix4> = { value: new THREE.Matrix4() };

/**
 * Aims every ENABLED and FIXED_Y billboard at `mainCamera`, and every PARTICLES one at
 * `passCamera`, before a billboarding draw. Each render writes its own cameras, so a SubViewport's
 * draws aim at the SubViewport's.
 */
export function aimBillboards(mainCamera: THREE.Camera, passCamera: THREE.Camera): void {
  MAIN_CAMERA_WORLD.value.copy(mainCamera.matrixWorld);
  PASS_CAMERA_WORLD.value.copy(passCamera.matrixWorld);
}

/**
 * `INSTANCE_CUSTOM.x` turns a PARTICLES billboard about the view axis (`material.cpp:1318-1322`).
 * A camera looking along world Y gives FIXED_Y a zero cross product, which GLSL cannot normalise,
 * so the surface keeps the model basis there.
 */
const BILLBOARD_BASES: Partial<Record<number, string>> = {
  [BillboardMode.BILLBOARD_ENABLED]: /* glsl */ `mat4 godotWorld = mat4(
		godotMainCameraWorld[ 0 ],
		godotMainCameraWorld[ 1 ],
		godotMainCameraWorld[ 2 ],
		godotModel[ 3 ] );`,
  [BillboardMode.BILLBOARD_FIXED_Y]: /* glsl */ `vec3 godotAxisX = cross( vec3( 0.0, 1.0, 0.0 ), godotMainCameraWorld[ 2 ].xyz );
	vec3 godotAxisZ = cross( godotMainCameraWorld[ 0 ].xyz, vec3( 0.0, 1.0, 0.0 ) );
	if ( dot( godotAxisX, godotAxisX ) == 0.0 || dot( godotAxisZ, godotAxisZ ) == 0.0 ) return godotModel;
	mat4 godotWorld = mat4(
		vec4( normalize( godotAxisX ), 0.0 ),
		vec4( 0.0, 1.0, 0.0, 0.0 ),
		vec4( normalize( godotAxisZ ), 0.0 ),
		godotModel[ 3 ] );`,
  [BillboardMode.BILLBOARD_PARTICLES]: /* glsl */ `mat4 godotWorld = mat4(
		normalize( godotPassCameraWorld[ 0 ] ),
		normalize( godotPassCameraWorld[ 1 ] ),
		normalize( godotPassCameraWorld[ 2 ] ),
		godotModel[ 3 ] );
	godotWorld = godotWorld * mat4(
		vec4( cos( ${INSTANCE_CUSTOM}.x ), - sin( ${INSTANCE_CUSTOM}.x ), 0.0, 0.0 ),
		vec4( sin( ${INSTANCE_CUSTOM}.x ), cos( ${INSTANCE_CUSTOM}.x ), 0.0, 0.0 ),
		vec4( 0.0, 0.0, 1.0, 0.0 ),
		vec4( 0.0, 0.0, 0.0, 1.0 ) );`,
};

/** `billboard_keep_scale` keeps the model matrix's column lengths (`material.cpp:1274-1281`). */
const KEPT_SCALE = /* glsl */ `godotWorld = godotWorld * mat4(
		vec4( length( godotModel[ 0 ].xyz ), 0.0, 0.0, 0.0 ),
		vec4( 0.0, length( godotModel[ 1 ].xyz ), 0.0, 0.0 ),
		vec4( 0.0, 0.0, length( godotModel[ 2 ].xyz ), 0.0 ),
		vec4( 0.0, 0.0, 0.0, 1.0 ) );`;

/**
 * Godot's MODEL_MATRIX for an instance is the node's times the instance's
 * (`scene_forward_clustered.glsl:341`), and the billboard replaces its basis. Declared before the
 * pose's macros, so it reads three's own matrices, beside the unit instance the pose folds an
 * instance into: a global must come before `main`.
 */
function billboardFunction({ mode, keepScale }: SurfaceBillboard): string {
  return /* glsl */ `uniform mat4 godotMainCameraWorld;
uniform mat4 godotPassCameraWorld;
#ifdef ${READS_INSTANCE_CUSTOM}
	attribute vec4 ${INSTANCE_CUSTOM_ATTRIBUTE};
	#define ${INSTANCE_CUSTOM} ${INSTANCE_CUSTOM_ATTRIBUTE}
#else
	#define ${INSTANCE_CUSTOM} vec4( 0.0 )
#endif
mat4 godotBillboard() {
	#ifdef USE_INSTANCING
		mat4 godotModel = modelMatrix * instanceMatrix;
	#else
		mat4 godotModel = modelMatrix;
	#endif
	${BILLBOARD_BASES[mode]}
	${keepScale ? KEPT_SCALE : ''}
	return godotWorld;
}
const mat4 godotUnitInstance = mat4( 1.0 );`;
}

/**
 * Every later read of three's pose takes the billboard: the model and model-view matrices are the
 * billboard, and an instance's own matrix is in it. Godot's billboard replaces MODELVIEW_MATRIX
 * alone, so a reader of MODEL_MATRIX reads three's own matrices, kept before the macros (`nodePose.ts`).
 */
const BILLBOARD_POSE = /* glsl */ `mat4 godotNodeModel = modelMatrix;
	#undef ${DRAWN_MODEL}
	#define ${DRAWN_MODEL} godotNodeModel
	#ifdef USE_INSTANCING
		mat4 godotNodeInstance = instanceMatrix;
		#undef ${DRAWN_INSTANCE}
		#define ${DRAWN_INSTANCE} godotNodeInstance
		#define instanceMatrix godotUnitInstance
	#endif
	mat4 godotBillboardWorld = godotBillboard();
	mat4 godotBillboardModelView = viewMatrix * godotBillboardWorld;
	#define modelMatrix godotBillboardWorld
	#define modelViewMatrix godotBillboardModelView
${UV_CHUNK}`;

function poseInjection(billboard: SurfaceBillboard): ProgramInjection {
  return {
    cacheKey: `godot-billboard:${billboard.mode}:${billboard.keepScale}`,
    onBeforeCompile(shader) {
      shader.uniforms.godotMainCameraWorld = MAIN_CAMERA_WORLD;
      shader.uniforms.godotPassCameraWorld = PASS_CAMERA_WORLD;
      // Before `main`, not at the top: instanced points declare `instanceMatrix` at the top of their
      // text (`godotPoint.ts`), which the billboard reads.
      editedProgram(
        shader,
        {
          vertex: [
            { three: MAIN_CHUNK, godot: `${billboardFunction(billboard)}\n${MAIN_CHUNK}` },
            { three: UV_CHUNK, godot: BILLBOARD_POSE },
          ],
        },
        'billboard'
      );
    },
  };
}

/** What a billboarding surface's colour and depth programs compile with. */
export interface BillboardInjections {
  /** The pose and the normal turn. */
  colour: ProgramInjection;
  /** The pose alone: a depth program reads no normal. */
  depth: ProgramInjection;
}

/** The injections of each billboard, by mode and `keep_scale`, so each compiles one program. */
const billboardInjectionsByKey = new Map<string, BillboardInjections>();

/** The injections of `billboard`, or undefined for a mode with no billboard. */
export function billboardInjections(billboard: SurfaceBillboard): BillboardInjections | undefined {
  if (BILLBOARD_BASES[billboard.mode] === undefined) return undefined;
  const key = `${billboard.mode}:${billboard.keepScale}`;
  let injections = billboardInjectionsByKey.get(key);
  if (!injections) {
    const depth = poseInjection(billboard);
    injections = { colour: composeInjections([depth, BILLBOARD_NORMAL])!, depth };
    billboardInjectionsByKey.set(key, injections);
  }
  return injections;
}
