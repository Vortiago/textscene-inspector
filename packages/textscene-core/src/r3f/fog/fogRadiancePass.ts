/**
 * Bakes the sky's radiance into the atlas the aerial perspective reads: one equirectangular band
 * per roughness the depth fog samples at, in the sky's own space and times its energy, as Godot's
 * radiance holds it (`forward_clustered/render_forward_clustered.cpp:2045-2049`). A redraw follows
 * a new sky or a new energy only.
 */

import * as THREE from 'three';
import { glslFloat } from '../../utils/glslLiterals.js';
import { drawFullScreen, fullScreenPass } from '../fullScreenPass.js';
import { drawOffscreen } from '../offscreen.js';
import { bindRadiance } from './fogSky.js';
import {
  FOG_RADIANCE_BANDS,
  FOG_RADIANCE_BAND_HEIGHT,
  FOG_RADIANCE_BAND_WIDTH,
  fogUniforms,
} from './fogUniforms.js';

/** One texel per atlas fragment: its band's roughness, and the sky along its equirect direction. */
const RADIANCE_FRAGMENT = /* glsl */ `
#include <common>
#include <cube_uv_reflection_fragment>

uniform float energy;

#ifdef ENVMAP_TYPE_CUBE_UV
	uniform sampler2D envMap;
#endif

void main() {
	vec2 atlas = gl_FragCoord.xy / vec2( ${glslFloat(FOG_RADIANCE_BAND_WIDTH)}, ${glslFloat(FOG_RADIANCE_BAND_HEIGHT * FOG_RADIANCE_BANDS)} );
	float band = floor( atlas.y * ${glslFloat(FOG_RADIANCE_BANDS)} );
	float latitude = ( fract( atlas.y * ${glslFloat(FOG_RADIANCE_BANDS)} ) - 0.5 ) * PI;
	float longitude = ( atlas.x - 0.5 ) * PI2;
	vec3 direction = vec3( cos( latitude ) * cos( longitude ), sin( latitude ), cos( latitude ) * sin( longitude ) );
	vec3 radiance = vec3( 0.0 );
	#ifdef ENVMAP_TYPE_CUBE_UV
		radiance = textureCubeUV( envMap, direction, ( band + 1.0 ) / ${glslFloat(FOG_RADIANCE_BANDS)} ).rgb * energy;
	#endif
	gl_FragColor = vec4( radiance, 1.0 );
}
`;

export class FogRadiancePass {
  private readonly target = new THREE.WebGLRenderTarget(
    FOG_RADIANCE_BAND_WIDTH,
    FOG_RADIANCE_BAND_HEIGHT * FOG_RADIANCE_BANDS,
    { depthBuffer: false, stencilBuffer: false }
  );
  private readonly material = fullScreenPass('FogRadiance', RADIANCE_FRAGMENT, {
    envMap: { value: null },
    energy: { value: 1 },
  });
  /** What the atlas holds, undefined before the first bake. */
  private baked: { radiance: THREE.Texture | null; energy: number } | undefined;

  constructor() {
    this.target.texture = fogUniforms.radiance;
  }

  /** Bakes `radiance` times `energy` unless the atlas already holds them. Null bakes black. */
  bake(renderer: THREE.WebGLRenderer, radiance: THREE.Texture | null, energy: number): void {
    if (this.baked?.radiance === radiance && this.baked.energy === energy) return;
    this.baked = { radiance, energy };
    bindRadiance(this.material, radiance);
    this.material.uniforms['energy']!.value = energy;
    drawOffscreen(renderer, () => drawFullScreen(renderer, this.material, this.target));
  }

  dispose(): void {
    this.target.dispose();
    this.material.dispose();
  }
}
