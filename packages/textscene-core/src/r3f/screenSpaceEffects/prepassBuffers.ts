/**
 * The buffers of one world buffer's normal-roughness prepass, which every screen-space effect of a
 * render reads: the depth and the encoded normal and roughness of each sample of the frame, and the
 * samples resolved into one frame as Godot resolves a multisampled prepass
 * (`render_forward_clustered.cpp:2114-2119`). Each holds three's rows.
 */

import * as THREE from 'three';
import { perObject } from '../../utils/perObject.js';
import { drawPass, multipleTargetPass, namedUniformPass } from '../fullScreenPass.js';
import { GODOT_DEPTH } from './frameGlsl.js';

/** Godot's R8G8B8A8_UNORM normal and roughness. */
const NORMAL_ROUGHNESS: THREE.RenderTargetOptions = {
  depthBuffer: false,
  generateMipmaps: false,
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  type: THREE.UnsignedByteType,
};

/** The world buffer a prepass serves. */
export interface PrepassShape {
  width: number;
  height: number;
  /** The world buffer's samples per pixel, 0 for one. */
  samples: number;
}

export class PrepassBuffers {
  readonly shape: PrepassShape;
  /**
   * The normal and roughness, and the depth, of each sample of the frame at the world buffer's size,
   * as WebGL reads no multisampled texture. One target for a frame of one sample.
   */
  readonly samplePrepasses: readonly THREE.WebGLRenderTarget[];
  /**
   * The samples resolved into one frame, as Godot resolves them: the depth, then the normal and
   * roughness. Null for a frame of one sample.
   */
  readonly resolved: THREE.WebGLRenderTarget | null;

  constructor(shape: PrepassShape) {
    const { width, height, samples } = shape;
    this.shape = { ...shape };
    this.samplePrepasses = Array.from({ length: Math.max(1, samples) }, () => prepassTarget(width, height));
    this.resolved = samples > 1 ? resolvedTarget(width, height) : null;
  }

  fits(shape: PrepassShape): boolean {
    const own = this.shape;
    return own.width === shape.width && own.height === shape.height && own.samples === shape.samples;
  }

  /** The frame's depth in three's form, 0 at the near plane, in three's rows. */
  get frameDepth(): THREE.Texture {
    return this.resolved?.textures[0] ?? this.samplePrepasses[0]!.depthTexture!;
  }

  /** The frame's encoded normal and roughness, in three's rows. */
  get frameNormalRoughness(): THREE.Texture {
    return this.resolved?.textures[1] ?? this.samplePrepasses[0]!.texture;
  }

  dispose(): void {
    for (const prepass of this.samplePrepasses) {
      prepass.depthTexture?.dispose();
      prepass.dispose();
    }
    this.resolved?.dispose();
  }
}

/** The normal and roughness, over a 32-bit float depth that the passes read back. */
function prepassTarget(width: number, height: number): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, { ...NORMAL_ROUGHNESS, depthBuffer: true });
  target.depthTexture = new THREE.DepthTexture(width, height, THREE.FloatType);
  return target;
}

/** The resolve's R32F depth beside its RGBA8 normal and roughness, both drawn by one pass. */
function resolvedTarget(width: number, height: number): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, { ...NORMAL_ROUGHNESS, count: 2 });
  const depth = target.textures[0]!;
  depth.type = THREE.FloatType;
  depth.format = THREE.RedFormat;
  return target;
}

/**
 * The frame's depth and normal and roughness from its samples, as Godot resolves a multisampled
 * prepass (`effects/resolve.glsl`, `MODE_RESOLVE_GI`): both of the one sample the rule below picks,
 * in three's rows and depth. Sample `i` is drawn into `depth<i>` and `normalRoughness<i>`, since
 * WebGL reads no multisampled texture. One draw writes both, one to each attachment.
 */
function sampleResolveFragment(samples: number): string {
  const indices = Array.from({ length: samples }, (_, index) => index);
  const declarations = indices
    .map((i) => `uniform highp sampler2D depth${i};\nuniform highp sampler2D normalRoughness${i};`)
    .join('\n');
  const depthReads = indices
    .map((i) => `if ( i == ${i} ) return texelFetch( depth${i}, pixel, 0 ).x;`)
    .join('\n\t');
  const normalReads = indices
    .map((i) => `if ( i == ${i} ) return texelFetch( normalRoughness${i}, pixel, 0 );`)
    .join('\n\t');
  return /* glsl */ `
#define SAMPLES ${samples}
${declarations}
${GODOT_DEPTH}
layout( location = 0 ) out highp vec4 resolvedDepth;
layout( location = 1 ) out highp vec4 resolvedNormalRoughness;

float threeDepthOf( int i, ivec2 pixel ) {
	${depthReads}
	return 1.0;
}

vec4 normalRoughnessOf( int i, ivec2 pixel ) {
	${normalReads}
	return vec4( 0.0 );
}

// Two samples keep the one nearer the camera. Four or eight keep the depth fewest samples share,
// the first of a tie, from each group of four, and of eight Godot's \`mix( best_index0,
// best_index1, min_f0 < min_f1 )\` keeps the second group's when the first group's count is lower.
int bestSample( ivec2 pixel ) {
	float depths[ SAMPLES ];
	for ( int i = 0; i < SAMPLES; i ++ ) depths[ i ] = godotDepth( threeDepthOf( i, pixel ) );
#if SAMPLES == 2
	return depths[ 0 ] < depths[ 1 ] ? 1 : 0;
#elif SAMPLES == 4 || SAMPLES == 8
	int best[ 2 ] = int[ 2 ]( 0, 4 );
	float least[ 2 ] = float[ 2 ]( 1e20, 1e20 );
	for ( int group = 0; group < SAMPLES / 4; group ++ ) {
		for ( int i = group * 4; i < group * 4 + 4; i ++ ) {
			float frequency = 0.0;
			for ( int j = 0; j < SAMPLES; j ++ ) frequency += depths[ i ] == depths[ j ] ? 1.0 : 0.0;
			if ( frequency < least[ group ] ) {
				least[ group ] = frequency;
				best[ group ] = i;
			}
		}
	}
#if SAMPLES == 4
	return best[ 0 ];
#else
	return least[ 0 ] < least[ 1 ] ? best[ 1 ] : best[ 0 ];
#endif
#else
	return 0;
#endif
}

void main() {
	ivec2 pixel = ivec2( gl_FragCoord.xy );
	int best = bestSample( pixel );
	resolvedDepth = vec4( threeDepthOf( best, pixel ), 0.0, 0.0, 0.0 );
	resolvedNormalRoughness = normalRoughnessOf( best, pixel );
}
`;
}

/** Each renderer's sample resolve, one per sample count, as the count shapes its program. */
const sampleResolvesOf = perObject(
  (_renderer: THREE.WebGLRenderer) => new Map<number, THREE.ShaderMaterial>()
);

function sampleResolveOf(renderer: THREE.WebGLRenderer, samples: number): THREE.ShaderMaterial {
  const resolves = sampleResolvesOf(renderer);
  let resolve = resolves.get(samples);
  if (!resolve) {
    const names = Array.from({ length: samples }, (_, i) => [`depth${i}`, `normalRoughness${i}`]).flat();
    resolve = multipleTargetPass(namedUniformPass('SampleResolve', sampleResolveFragment(samples), names));
    resolves.set(samples, resolve);
  }
  return resolve;
}

/**
 * Resolves the samples' prepasses into one frame, where the world buffer has more than one sample.
 * The caller restores the renderer's target.
 */
export function resolveSamples(renderer: THREE.WebGLRenderer, buffers: PrepassBuffers): void {
  if (!buffers.resolved) return;
  const pass = sampleResolveOf(renderer, buffers.samplePrepasses.length);
  const values = Object.fromEntries(
    buffers.samplePrepasses.flatMap((prepass, i) => [
      [`depth${i}`, prepass.depthTexture],
      [`normalRoughness${i}`, prepass.texture],
    ])
  );
  drawPass(renderer, pass, values, buffers.resolved);
}
