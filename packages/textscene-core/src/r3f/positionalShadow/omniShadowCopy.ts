/**
 * Godot's `copy_cubemap_to_dp` (`servers/rendering/renderer_rd/effects/copy_effects.cpp:1082-1119`,
 * `shaders/effects/cube_to_dp.glsl`): it writes an omni light's cube into the light's two slots of
 * the positional shadow atlas, one paraboloid per slot, each as the distance to the light over its
 * range.
 */

import * as THREE from 'three';
import type { PositionalShadowSlot } from '../../godot/positionalShadowAtlas.js';
import { drawFullScreen, fullScreenPass } from '../fullScreenPass.js';
import { PACK_ATLAS_DEPTH } from './atlasDepthMaterials.js';
import { lightPoseMatrix } from './lightPose.js';
import { positionalShadowAtlas } from './shadowAtlasTarget.js';

/**
 * `cube_to_dp.glsl`'s fragment stage, which reads three's cube through a world direction. A depth
 * texture reads only unfiltered (OpenGL ES 3.0 §3.8.13), so it filters the four nearest texels
 * itself, as Godot's linear sampler does (`copy_effects.cpp:1104`). It writes the depth into the
 * atlas's colour too, for the blocker search. `positionalShadow.md` has more.
 */
const FRAGMENT = /* glsl */ `${PACK_ATLAS_DEPTH}
uniform samplerCube cube;
uniform float faceSize;
uniform float zNear;
uniform float zFar;
uniform float texelSize;
uniform float paraboloidSign;
uniform mat3 lightToWorld;
varying vec2 vUv;

float cubeTexel( vec3 major, vec3 sAxis, vec3 tAxis, vec2 texel ) {
	vec2 face = ( texel + 0.5 ) / faceSize * 2.0 - 1.0;
	return textureLod( cube, major + face.x * sAxis + face.y * tAxis, 0.0 ).r;
}

// The face a direction selects and its s and t axes (OpenGL ES 3.0 Table 3.21).
float cubeDepth( vec3 dir ) {
	vec3 a = abs( dir );
	float ma;
	vec3 major;
	vec3 sAxis;
	vec3 tAxis;
	if ( a.x >= a.y && a.x >= a.z ) {
		ma = a.x;
		major = vec3( sign( dir.x ), 0.0, 0.0 );
		sAxis = vec3( 0.0, 0.0, - sign( dir.x ) );
		tAxis = vec3( 0.0, - 1.0, 0.0 );
	} else if ( a.y >= a.z ) {
		ma = a.y;
		major = vec3( 0.0, sign( dir.y ), 0.0 );
		sAxis = vec3( 1.0, 0.0, 0.0 );
		tAxis = vec3( 0.0, 0.0, sign( dir.y ) );
	} else {
		ma = a.z;
		major = vec3( 0.0, 0.0, sign( dir.z ) );
		sAxis = vec3( sign( dir.z ), 0.0, 0.0 );
		tAxis = vec3( 0.0, - 1.0, 0.0 );
	}
	vec2 face = vec2( dot( dir, sAxis ), dot( dir, tAxis ) ) / ma;
	vec2 texel = ( face * 0.5 + 0.5 ) * faceSize - 0.5;
	vec2 base = floor( texel );
	vec2 f = texel - base;
	float bottom = mix( cubeTexel( major, sAxis, tAxis, base ), cubeTexel( major, sAxis, tAxis, base + vec2( 1.0, 0.0 ) ), f.x );
	float top = mix( cubeTexel( major, sAxis, tAxis, base + vec2( 0.0, 1.0 ) ), cubeTexel( major, sAxis, tAxis, base + vec2( 1.0 ) ), f.x );
	return mix( bottom, top, f.y );
}

void main() {
	vec2 uv = clamp( vUv * ( 1.0 + 2.0 * texelSize ) - texelSize, vec2( 0.0 ), vec2( 1.0 ) );
	vec3 normal = vec3( uv * 2.0 - 1.0, 0.0 );
	normal.z = 0.5 * ( 1.0 - dot( normal.xy, normal.xy ) );
	normal = normalize( normal );
	normal.z *= paraboloidSign;
	vec3 dir = lightToWorld * normal;
	vec3 a = abs( dir );
	float axisCos = max( max( a.x, a.y ), a.z );
	float ndcDepth = 2.0 * cubeDepth( dir ) - 1.0;
	float viewDepth = 2.0 * zNear * zFar / ( zFar + zNear - ndcDepth * ( zFar - zNear ) );
	float depth = viewDepth / axisCos / zFar;
	gl_FragDepth = depth;
	gl_FragColor = vec4( packAtlasDepth( depth ), 0.0, 1.0 );
}
`;

/** The first paraboloid looks down the light's -Z, and the second down its +Z (`cube_to_dp.glsl`). */
const PARABOLOID_SIGNS = [-1, 1] as const;

/** Written only by `OmniShadowCopy.copy`, and valid only inside that call. */
const scratchLightPose = new THREE.Matrix4();

export class OmniShadowCopy {
  private readonly material = copyPass();

  /**
   * Writes the cube three rendered for `light` into both of its slots. Godot passes the cube camera's
   * near plane and the range as the far one (`render_forward_clustered.cpp:2732-2734`), which three's
   * shadow camera holds after its pass (`WebGLShadowMap.js:302-308`). The caller restores the render
   * target.
   */
  copy(renderer: THREE.WebGLRenderer, light: THREE.PointLight, slot: PositionalShadowSlot): void {
    const cube = light.shadow.map;
    if (!slot.paraboloidStep || !(cube instanceof THREE.WebGLCubeRenderTarget)) return;
    const uniforms = this.material.uniforms;
    uniforms.cube!.value = cube.depthTexture;
    uniforms.faceSize!.value = cube.width;
    uniforms.zNear!.value = light.shadow.camera.near;
    uniforms.zFar!.value = light.shadow.camera.far;
    uniforms.texelSize!.value = 1 / slot.size;
    // `setFromMatrix4` keeps the pose's rotation and drops its translation.
    (uniforms.lightToWorld!.value as THREE.Matrix3).setFromMatrix4(lightPoseMatrix(light, scratchLightPose));
    for (let paraboloid = 0; paraboloid < PARABOLOID_SIGNS.length; paraboloid++) {
      uniforms.paraboloidSign!.value = PARABOLOID_SIGNS[paraboloid];
      this.drawInto(renderer, slot, paraboloid);
    }
  }

  dispose(): void {
    this.material.dispose();
  }

  /**
   * Draws the quad over one slot. three binds a target with its own viewport and scissor
   * (`WebGLRenderer.js:3040-3071`). The render neither clears nor counts towards the frame's render
   * info, which three would otherwise reset (`WebGLRenderer.js:1731`).
   */
  private drawInto(renderer: THREE.WebGLRenderer, slot: PositionalShadowSlot, paraboloid: number): void {
    const atlas = positionalShadowAtlas();
    const [stepX, stepY] = slot.paraboloidStep!;
    const x = slot.x + paraboloid * stepX * slot.size;
    const y = slot.y + paraboloid * stepY * slot.size;
    atlas.viewport.set(x, y, slot.size, slot.size);
    atlas.scissor.set(x, y, slot.size, slot.size);
    atlas.scissorTest = true;
    const { autoClear } = renderer;
    const { autoReset } = renderer.info;
    renderer.autoClear = false;
    renderer.info.autoReset = false;
    try {
      drawFullScreen(renderer, this.material, atlas);
    } finally {
      renderer.autoClear = autoClear;
      renderer.info.autoReset = autoReset;
    }
  }
}

/** The copy writes every texel's depth through `gl_FragDepth`, as `cube_to_dp.glsl` does, so it always passes. */
function copyPass(): THREE.ShaderMaterial {
  const pass = fullScreenPass('OmniShadowCopy', FRAGMENT, {
    cube: { value: null },
    faceSize: { value: 1 },
    zNear: { value: 0 },
    zFar: { value: 1 },
    texelSize: { value: 0 },
    paraboloidSign: { value: -1 },
    lightToWorld: { value: new THREE.Matrix3() },
  });
  pass.depthTest = true;
  pass.depthFunc = THREE.AlwaysDepth;
  pass.depthWrite = true;
  return pass;
}
