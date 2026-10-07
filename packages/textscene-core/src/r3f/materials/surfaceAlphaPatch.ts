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

/**
 * Whether three sends the surface through the blend equation. `WebGLState.setMaterial` turns
 * blending off for NoBlending, and for NormalBlending without `transparent`.
 */
export function isBlended(blend: SurfaceBlend): boolean {
  const blending = blend.blending ?? THREE.NormalBlending;
  if (blending === THREE.NoBlending) return false;
  return blending !== THREE.NormalBlending || blend.transparent === true;
}

/** What a blended surface adds to its material props so three blends the alpha Godot writes. */
export interface SurfaceAlphaProps {
  blending?: THREE.Blending;
  injection?: ProgramInjection;
}

const NO_PROPS: SurfaceAlphaProps = Object.freeze({});
const OVERWRITE: SurfaceAlphaProps = Object.freeze({ blending: THREE.NoBlending });
const CUT_TO_OPAQUE: SurfaceAlphaProps = Object.freeze({ injection: OPAQUE_AFTER_CUT });
const ALBEDO_IGNORED: SurfaceAlphaProps = Object.freeze({ injection: ALBEDO_ALPHA_UNREAD });

/**
 * The props a surface needs so that three blends the alpha its Godot shader writes. A MIX blend
 * of alpha 1 overwrites, which three spells as NoBlending: no patched program, and no compositor.
 */
export function surfaceAlphaProps(source: SurfaceAlphaSource, blend: SurfaceBlend): SurfaceAlphaProps {
  if (!isBlended(blend)) return NO_PROPS;
  if (source.opaqueAfterCut) {
    return (blend.blending ?? THREE.NormalBlending) === THREE.NormalBlending ? OVERWRITE : CUT_TO_OPAQUE;
  }
  return source.readsAlbedoAlpha ? NO_PROPS : ALBEDO_IGNORED;
}
