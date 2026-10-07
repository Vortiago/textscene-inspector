/**
 * Fragment-alpha patches for a blended surface whose Godot shader sets ALPHA otherwise than
 * three's material does. An unblended surface needs none: three's `OPAQUE` define writes alpha 1.
 */

import * as THREE from 'three';
import type { ProgramInjection, ProgramShader } from '../materialProgramInputs';

/** Where a surface's Godot shader takes its final ALPHA from. */
export interface SurfaceAlphaSource {
  /**
   * Whether the shader multiplies the albedo alpha in (`material.cpp:1832-1837`). One that does
   * not keeps the instance alpha it starts from, whatever its texture or vertex colours hold.
   */
  readsAlbedoAlpha: boolean;
  /** Whether it writes alpha 1 for each fragment its cut keeps (`scene_forward_clustered.glsl:1413-1415`). */
  opaqueAfterCut: boolean;
}

/** The material state that decides whether the fragment alpha reaches the framebuffer. */
export interface SurfaceBlend {
  transparent?: boolean;
  blending?: THREE.Blending;
}

const ALPHA_TEST_CHUNK = '#include <alphatest_fragment>';
const ALPHA_HASH_CHUNK = '#include <alphahash_fragment>';

function rewriteFragment(shader: ProgramShader, chunk: string, replacement: string): void {
  shader.fragmentShader = shader.fragmentShader.replace(chunk, replacement);
}

/** three multiplies the map and vertex-colour alpha into `diffuseColor.a`. This resets it to `opacity`. */
export const ALBEDO_ALPHA_UNREAD: ProgramInjection = {
  cacheKey: 'albedo-alpha-unread',
  onBeforeCompile: (shader) =>
    rewriteFragment(shader, ALPHA_TEST_CHUNK, `diffuseColor.a = opacity;\n\t${ALPHA_TEST_CHUNK}`),
};

/** three keeps the cut alpha in the blend. This writes alpha 1 for each fragment both cuts keep. */
export const OPAQUE_AFTER_CUT: ProgramInjection = {
  cacheKey: 'opaque-after-cut',
  onBeforeCompile: (shader) =>
    rewriteFragment(shader, ALPHA_HASH_CHUNK, `${ALPHA_HASH_CHUNK}\n\tdiffuseColor.a = 1.0;`),
};

/** The patch a surface needs so that three blends the alpha its Godot shader writes. */
export function surfaceAlphaPatch(
  source: SurfaceAlphaSource,
  blend: SurfaceBlend
): ProgramInjection | undefined {
  const isBlended =
    blend.transparent === true || (blend.blending ?? THREE.NormalBlending) !== THREE.NormalBlending;
  if (!isBlended) return undefined;
  if (source.opaqueAfterCut) return OPAQUE_AFTER_CUT;
  return source.readsAlbedoAlpha ? undefined : ALBEDO_ALPHA_UNREAD;
}
