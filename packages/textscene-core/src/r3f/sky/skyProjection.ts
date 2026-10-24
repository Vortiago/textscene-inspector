/**
 * Godot's sky projection: the sky pass reads only the scale and offset columns of the camera
 * projection (`sky.cpp:224-227`) and casts each pixel's ray through them at a depth of -1
 * (`sky.glsl:218-220`). Under a perspective camera that is the camera's own ray. Under an
 * orthographic one the sky spreads as through a lens whose tangent is the half-extent.
 */

import * as THREE from 'three';
import { installChunkEdits } from '../shaderPatch/chunkPatch.js';
import { backgroundCube } from '../shaderPatch/backgroundPrograms.js';

/** GLSL: the view-space ray of a clip-space `xy`, as `sky.glsl:218-220` builds it. */
export const GODOT_SKY_VIEW_RAY = /* glsl */ `vec3(
		( position.xy + vec2( projectionMatrix[ 2 ][ 0 ], projectionMatrix[ 2 ][ 1 ] ) )
			/ vec2( projectionMatrix[ 0 ][ 0 ], projectionMatrix[ 1 ][ 1 ] ),
		- 1.0 )`;

const THREE_CUBE_FAR_PLANE = 'gl_Position.z = gl_Position.w;';

/**
 * three's cube background projects its unit box through the camera, so an orthographic camera
 * draws the sky only inside the box's own extent. The inverse of `GODOT_SKY_VIEW_RAY` covers the
 * view, and is the camera's projection itself under a perspective camera.
 */
const GODOT_CUBE_PROJECTION = /* glsl */ `if ( isOrthographic ) {
		gl_Position = vec4(
			projectionMatrix[ 0 ][ 0 ] * mvPosition.x + projectionMatrix[ 2 ][ 0 ] * mvPosition.z,
			projectionMatrix[ 1 ][ 1 ] * mvPosition.y + projectionMatrix[ 2 ][ 1 ] * mvPosition.z,
			0.0,
			- mvPosition.z );
	}
	${THREE_CUBE_FAR_PLANE}`;

/**
 * Patches three's cube background for every program compiled after the call. three reads
 * `ShaderLib.backgroundCube` when a renderer first draws a cube background. A second call
 * changes nothing.
 */
export function installSkyProjection(): void {
  const isPatched = installChunkEdits({
    edits: [{ chunk: 'backgroundCube_vert', three: THREE_CUBE_FAR_PLANE, godot: GODOT_CUBE_PROJECTION }],
    mark: 'isOrthographic',
    patch: 'sky projection',
  });
  if (isPatched) backgroundCube().vertexShader = THREE.ShaderChunk.backgroundCube_vert;
}
