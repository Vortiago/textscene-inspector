/**
 * The world matrix and the normal matrix a billboarding StandardMaterial3D surface draws with.
 * Godot writes them in the vertex shader as a new `MODELVIEW_MATRIX` and
 * `MODELVIEW_NORMAL_MATRIX` (`scene/resources/material.cpp:1260-1335`), so they replace the model
 * basis for that surface alone and keep the model origin. A draw hook moves a plain draw's pose,
 * and the program billboards each instance of an instanced draw about its own origin.
 */

import * as THREE from 'three';
import { BillboardMode } from '../godot/rendering/materials/billboardMode';
import type { SurfaceBillboard } from '../resources/materials/standardmaterial3d/materialBag';
import { composeInjections, type ProgramInjection } from './materialProgramInputs';
import { editedChunk, editedProgram, rewrittenShader } from './shaderPatch/chunkPatch';
import { INSTANCE_CUSTOM_ATTRIBUTE } from './meshes/sharedInstances';

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/** Scratch vectors, overwritten by every call. */
const axisX = new THREE.Vector3();
const axisY = new THREE.Vector3();
const axisZ = new THREE.Vector3();
const cameraX = new THREE.Vector3();
const cameraZ = new THREE.Vector3();
const modelScale = new THREE.Vector3();

/**
 * Write the billboarded world matrix into `target`. The model's per-axis scale survives
 * only under `billboard_keep_scale` (`material.cpp:1274-1281`). Godot's default drops it.
 *
 * @param camera - the main camera's world matrix for ENABLED and FIXED_Y, and the pass
 *   camera's for PARTICLES, which reads `INV_VIEW_MATRIX` rather than `MAIN_CAM_INV_VIEW_MATRIX`
 * @returns false, with `target` untouched, when the mode does not billboard or the
 *   camera leaves FIXED_Y with no horizontal axis
 */
export function billboardWorldMatrix(
  target: THREE.Matrix4,
  model: THREE.Matrix4,
  camera: THREE.Matrix4,
  billboard: SurfaceBillboard
): boolean {
  const { mode } = billboard;
  switch (mode) {
    case BillboardMode.BILLBOARD_ENABLED:
    case BillboardMode.BILLBOARD_PARTICLES:
      camera.extractBasis(axisX, axisY, axisZ);
      if (mode === BillboardMode.BILLBOARD_PARTICLES) {
        axisX.normalize();
        axisY.normalize();
        axisZ.normalize();
      }
      break;
    case BillboardMode.BILLBOARD_FIXED_Y:
      if (!fixedYBasis(camera)) return false;
      break;
    default:
      return false;
  }

  // `length(MODEL_MATRIX[i].xyz)` per axis, the keep-scale factors.
  if (billboard.keepScale) modelScale.setFromMatrixScale(model);
  else modelScale.set(1, 1, 1);
  target.makeBasis(
    axisX.multiplyScalar(modelScale.x),
    axisY.multiplyScalar(modelScale.y),
    axisZ.multiplyScalar(modelScale.z)
  );
  target.copyPosition(model);
  return true;
}

/**
 * `normalize(cross(up, camZ))`, `up`, `normalize(cross(camX, up))` (`material.cpp:1291-1295`).
 * A camera looking along world Y gives a zero cross product, which GLSL cannot
 * normalise, so the surface keeps the model basis there.
 */
function fixedYBasis(camera: THREE.Matrix4): boolean {
  cameraX.setFromMatrixColumn(camera, 0);
  cameraZ.setFromMatrixColumn(camera, 2);
  axisX.crossVectors(WORLD_UP, cameraZ);
  axisZ.crossVectors(cameraX, WORLD_UP);
  if (axisX.lengthSq() === 0 || axisZ.lengthSq() === 0) return false;
  axisX.normalize();
  axisY.copy(WORLD_UP);
  axisZ.normalize();
  return true;
}

const DEFAULT_NORMAL_INCLUDE = /#include <defaultnormal_vertex>/g;

/**
 * Godot's billboard turns normals by `mat3(MODELVIEW_MATRIX)` (`material.cpp:1284,1307,1338`), not
 * by its inverse transpose, so a kept non-uniform scale stretches them as it stretches the surface.
 * three writes `normalMatrix` after the draw hook (`WebGLRenderer.js:2161`), so the program reads
 * the hook's `modelViewMatrix`, and an instance its own billboard. The unshaded parallax adds a
 * second include, so every include turns.
 */
const BILLBOARD_NORMAL: ProgramInjection = {
  cacheKey: 'godot-billboard-normal',
  onBeforeCompile(shader) {
    const turn = {
      three: 'transformedNormal = normalMatrix * transformedNormal;',
      godot: 'transformedNormal = mat3( modelViewMatrix ) * transformedNormal;',
    };
    const chunk = `${editedChunk('defaultnormal_vertex', turn)}
#ifdef USE_INSTANCING
	transformedNormal = mat3( viewMatrix * godotInstanceWorld ) * objectNormal;
	#ifdef FLIP_SIDED
		transformedNormal = - transformedNormal;
	#endif
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
 * is one camera for every draw of a render. Written only by {@link aimInstanceBillboards}.
 */
const MAIN_CAMERA_WORLD: THREE.IUniform<THREE.Matrix4> = { value: new THREE.Matrix4() };

/**
 * The world matrix of the camera this pass draws through, which PARTICLES reads as
 * `INV_VIEW_MATRIX`, a uniform in Godot too. A uniform, not `inverse( viewMatrix )`: no matrix
 * inverse per vertex. Written only by {@link aimInstanceBillboards}.
 */
const PASS_CAMERA_WORLD: THREE.IUniform<THREE.Matrix4> = { value: new THREE.Matrix4() };

/**
 * Aims every ENABLED and FIXED_Y instance billboard at `mainCamera`, and every PARTICLES one at
 * `passCamera`, before an instanced draw. Each render writes its own cameras, so a SubViewport's
 * draws aim at the SubViewport's.
 */
export function aimInstanceBillboards(mainCamera: THREE.Camera, passCamera: THREE.Camera): void {
  MAIN_CAMERA_WORLD.value.copy(mainCamera.matrixWorld);
  PASS_CAMERA_WORLD.value.copy(passCamera.matrixWorld);
}

/** `INSTANCE_CUSTOM.x` turns a PARTICLES billboard about the view axis (`material.cpp:1318-1322`). */
const INSTANCE_BILLBOARD_BASES: Partial<Record<number, string>> = {
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
		vec4( cos( ${INSTANCE_CUSTOM_ATTRIBUTE}.x ), - sin( ${INSTANCE_CUSTOM_ATTRIBUTE}.x ), 0.0, 0.0 ),
		vec4( sin( ${INSTANCE_CUSTOM_ATTRIBUTE}.x ), cos( ${INSTANCE_CUSTOM_ATTRIBUTE}.x ), 0.0, 0.0 ),
		vec4( 0.0, 0.0, 1.0, 0.0 ),
		vec4( 0.0, 0.0, 0.0, 1.0 ) );`,
};

/**
 * Godot's MODEL_MATRIX for an instance is the node's times the instance's
 * (`scene_forward_clustered.glsl:341`), and the billboard replaces its basis.
 * `billboard_keep_scale` keeps that matrix's column lengths (`material.cpp:1274-1281`). A draw with
 * no custom data, as a GridMap's, reads `INSTANCE_CUSTOM` as the attribute default `(0, 0, 0, 1)`.
 */
function instanceBillboardFunction({ mode, keepScale }: SurfaceBillboard): string {
  const customDeclaration =
    mode === BillboardMode.BILLBOARD_PARTICLES ? `attribute vec4 ${INSTANCE_CUSTOM_ATTRIBUTE};` : '';
  const keptScale = keepScale
    ? /* glsl */ `godotWorld = godotWorld * mat4(
		vec4( length( godotModel[ 0 ].xyz ), 0.0, 0.0, 0.0 ),
		vec4( 0.0, length( godotModel[ 1 ].xyz ), 0.0, 0.0 ),
		vec4( 0.0, 0.0, length( godotModel[ 2 ].xyz ), 0.0 ),
		vec4( 0.0, 0.0, 0.0, 1.0 ) );`
    : '';
  return /* glsl */ `#ifdef USE_INSTANCING
uniform mat4 godotMainCameraWorld;
uniform mat4 godotPassCameraWorld;
${customDeclaration}
mat4 godotInstanceBillboard() {
	mat4 godotModel = modelMatrix * instanceMatrix;
	${INSTANCE_BILLBOARD_BASES[mode]}
	${keptScale}
	return godotWorld;
}
#endif`;
}

const UV_CHUNK = '#include <uv_vertex>';
const MAIN_CHUNK = 'void main() {';

/**
 * three multiplies `modelMatrix` after `instanceMatrix`, so the instance carries the node's inverse
 * and every chunk that reads it draws the billboard. A macro after the attribute's declaration, so
 * each later read takes the billboard.
 */
const INSTANCE_POSE = /* glsl */ `#ifdef USE_INSTANCING
	mat4 godotInstanceWorld = godotInstanceBillboard();
	mat4 godotInstanceLocal = inverse( modelMatrix ) * godotInstanceWorld;
	#define instanceMatrix godotInstanceLocal
#endif
${UV_CHUNK}`;

function instancePoseInjection(billboard: SurfaceBillboard): ProgramInjection {
  return {
    cacheKey: `godot-instance-billboard:${billboard.mode}:${billboard.keepScale}`,
    onBeforeCompile(shader) {
      shader.uniforms.godotMainCameraWorld = MAIN_CAMERA_WORLD;
      shader.uniforms.godotPassCameraWorld = PASS_CAMERA_WORLD;
      // Before `main`, not at the top: instanced points declare `instanceMatrix` at the top of their
      // text (`godotPoint.ts`), which the billboard reads.
      const declarations = `${instanceBillboardFunction(billboard)}\n${MAIN_CHUNK}`;
      editedProgram(
        shader,
        {
          vertex: [
            { three: MAIN_CHUNK, godot: declarations },
            { three: UV_CHUNK, godot: INSTANCE_POSE },
          ],
        },
        'instance billboard'
      );
    },
  };
}

/** The injections of each billboard, by mode and `keep_scale`, so each compiles one program. */
const billboardInjectionsByKey = new Map<string, { colour: ProgramInjection; depth: ProgramInjection }>();

/**
 * What a billboarding surface's colour and depth programs compile with: the instance pose for an
 * instanced draw, and the colour program's normal turn. Undefined for a mode with no billboard.
 */
export function billboardInjections({
  mode,
  keepScale,
}: SurfaceBillboard): { colour: ProgramInjection; depth: ProgramInjection } | undefined {
  if (INSTANCE_BILLBOARD_BASES[mode] === undefined) return undefined;
  const key = `${mode}:${keepScale}`;
  let injections = billboardInjectionsByKey.get(key);
  if (!injections) {
    const depth = instancePoseInjection({ mode, keepScale });
    injections = { colour: composeInjections([depth, BILLBOARD_NORMAL])!, depth };
    billboardInjectionsByKey.set(key, injections);
  }
  return injections;
}
