/**
 * Godot's best-fit normals: a normal stored in 8 bits a channel keeps closest to its direction when
 * it is first scaled to the length a table gives (`forward_clustered/best_fit_normal.glsl`,
 * `scene_forward_clustered.glsl:1183-1203`). Each renderer draws the table once.
 */

import * as THREE from 'three';
import { perObject } from '../../utils/perObject.js';
import { drawFullScreen, fullScreenPass } from '../fullScreenPass.js';
import { drawOffscreen } from '../offscreen.js';
import { showInSlot } from '../sharedTexture.js';
import { bestFitNormalsSlot, SCREEN_SPACE_UNIFORM } from './screenSpaceState.js';

/** Godot's table is 1024 texels square (`render_forward_clustered.cpp:5058-5061`). */
const TABLE_SIZE = 1024;

/** `encode24`, which reads the table through the slot `SCREEN_SPACE_UNIFORM.bestFitNormals` declares. */
export const GODOT_ENCODE_NORMAL = /* glsl */ `
vec3 godotEncodeNormal( vec3 v ) {
	vec3 vNormalUns = abs( v );
	float maxNAbs = max( vNormalUns.z, max( vNormalUns.x, vNormalUns.y ) );
	vec2 vTexCoord = vNormalUns.z < maxNAbs ? ( vNormalUns.y < maxNAbs ? vNormalUns.yz : vNormalUns.xz ) : vNormalUns.xy;
	vTexCoord /= maxNAbs;
	vTexCoord = vTexCoord.x < vTexCoord.y ? vTexCoord.yx : vTexCoord.xy;
	vTexCoord.y /= vTexCoord.x;
	float fFittingScale = textureLod( ${SCREEN_SPACE_UNIFORM.bestFitNormals}, vTexCoord, 0.0 ).r;
	return v / maxNAbs * fFittingScale;
}
`;

/** For each direction, the length whose 8-bit store errs least from it. */
const TABLE_FRAGMENT = /* glsl */ `
vec3 quantize( vec3 c ) {
	return round( clamp( c * 0.5 + 0.5, 0.0, 1.0 ) * 255.0 ) * ( 1.0 / 255.0 ) * 2.0 - 1.0;
}

float find_minimum_error( vec3 normal ) {
	float min_error = 100000.0;
	float t_best = 0.0;
	for ( float nstep = 1.5; nstep < 127.5; ++ nstep ) {
		float t = nstep / 127.5;
		vec3 vp = normal * t;
		vec3 quantizedp = quantize( vp );
		vec3 vdiff = ( quantizedp - vp ) / t;
		float error = max( abs( vdiff.x ), max( abs( vdiff.y ), abs( vdiff.z ) ) );
		if ( error < min_error ) {
			min_error = error;
			t_best = t;
		}
	}
	return t_best;
}

void main() {
	vec2 uv = floor( gl_FragCoord.xy ) * vec2( 1.0 / 1024.0 ) + vec2( 0.5 / 1024.0 );
	uv.y *= uv.x;
	vec3 dir = vec3( uv.x, uv.y, 1.0 );
	gl_FragColor = vec4( find_minimum_error( dir ), 1.0, 1.0, 1.0 );
}
`;

/** The R8 table, read by its nearest texel (`SAMPLER_NEAREST_CLAMP`). Kept for the renderer's life. */
const tableOf = perObject((renderer: THREE.WebGLRenderer) => {
  const table = new THREE.WebGLRenderTarget(TABLE_SIZE, TABLE_SIZE, {
    depthBuffer: false,
    generateMipmaps: false,
    type: THREE.UnsignedByteType,
    format: THREE.RedFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  });
  table.texture.name = 'BestFitNormals';
  const pass = fullScreenPass('BestFitNormals', TABLE_FRAGMENT, {});
  drawOffscreen(renderer, () => drawFullScreen(renderer, pass, table));
  pass.dispose();
  return table;
});

/** Shows `renderer`'s table in the slot every encoder reads, drawing it on the first call. */
export function showBestFitNormals(renderer: THREE.WebGLRenderer): void {
  showInSlot(renderer, bestFitNormalsSlot, tableOf(renderer).texture);
}
