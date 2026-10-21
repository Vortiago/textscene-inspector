/**
 * The filter is checked against the installed three's shadow chunk, so a release that rewrites the
 * sun block it precedes fails here and not in a golden.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SOFT_LOW_SHADOW_SAMPLES, vogelDisk } from '../../godot/rendering/lights/softShadowKernel';
import { GODOT_QUICK_HASH_GLSL } from '../../godot/rendering/quickHash';
import { FRAMEBUFFER_HEIGHT_UNIFORM } from './framebufferRows';
import { installedFramebufferHeight } from './framebufferRows.testkit';
import { clampedBilinearDepthGlsl } from './clampedBilinearDepth';
import { installSoftShadowFilter } from './softShadowFilter';
import { occurrences } from '../testing/glslSource';
import { warningsOf } from '../testing/logWarnings';
import { installedShaderChunks, FILTER_PCF, restoreShaderGlobalsAfterEach } from '../testing/shaderPatches';

const CHUNK = 'shadowmap_pars_fragment';
const threeChunk = THREE.ShaderChunk[CHUNK];

restoreShaderGlobalsAfterEach();

/** The shadow chunk a canvas compiles with. */
const installedChunk = () => installedShaderChunks()[CHUNK];

/** The float literals of the kernel the GLSL declares. */
function kernelLiterals(): number[] {
  const kernel = /GODOT_SOFT_SHADOW_KERNEL\[ \d+ \] = vec2\[\]\((.*)\);/.exec(installedChunk())![1]!;
  return [...kernel.matchAll(/vec2\( (\S+), (\S+) \)/g)].flatMap((match) => [
    Number(match[1]),
    Number(match[2]),
  ]);
}

/** The text `after` holds where `before` holds nothing, or null when `after` changes more than that. */
function insertion(before: string, after: string): string | null {
  let start = 0;
  while (start < before.length && before[start] === after[start]) start++;
  const inserted = after.slice(start, start + after.length - before.length);
  return after.slice(0, start) + after.slice(start + inserted.length) === before ? inserted : null;
}

describe('the soft shadow filter', () => {
  it('declares Godot’s Soft Low kernel, each tap the float Godot stores', () => {
    expect(kernelLiterals()).toEqual(vogelDisk(SOFT_LOW_SHADOW_SAMPLES).flat());
  });

  it('takes every tap of the kernel and averages them', () => {
    expect(installedChunk()).toContain(`const int GODOT_SOFT_SHADOW_SAMPLES = ${SOFT_LOW_SHADOW_SAMPLES};`);
    expect(installedChunk()).toContain('for ( int i = 0; i < GODOT_SOFT_SHADOW_SAMPLES; i ++ )');
    expect(installedChunk()).toContain('return shadow * ( 1.0 / float( GODOT_SOFT_SHADOW_SAMPLES ) );');
  });

  it('turns the kernel by quick_hash of the fragment, rows counted from the top', () => {
    expect(installedChunk()).toContain(
      'vec2 fragCoord = vec2( gl_FragCoord.x, godotFramebufferHeight[ 0 ] - gl_FragCoord.y );'
    );
    expect(installedChunk()).toContain(GODOT_QUICK_HASH_GLSL);
    expect(installedChunk()).toContain('float r = godotQuickHash( fragCoord ) * PI2;');
    expect(installedChunk()).toContain('return mat2( vec2( cr, - sr ), vec2( sr, cr ) );');
  });

  it('declares Godot’s Soft Low penumbra kernel for every blocker search', () => {
    // `renderer_scene_render_rd.cpp:1158` and `:1205`: eight taps for an omni, spot, area or sun.
    expect(installedChunk()).toContain('const int GODOT_PENUMBRA_SHADOW_SAMPLES = 8;');
  });

  it('unpacks the two bytes of an atlas colour into the depth', () => {
    expect(installedChunk()).toContain('return dot( bytes, vec2( 256.0, 1.0 ) ) / 65535.0;');
  });

  it('writes every kernel value as a float GLSL accepts (edge case)', () => {
    const kernel = /GODOT_SOFT_SHADOW_KERNEL\[ \d+ \] = vec2\[\]\((.*)\);/.exec(installedChunk())![1]!;
    expect(kernel).not.toMatch(/[(, ]-?\d+ [,)]/);
  });
});

describe('the filter in the installed shadow chunk', () => {
  it('declares the filter once, inside the shadow block and ahead of every shadow type', () => {
    const chunk = installedChunk();
    const filter = chunk.indexOf(FILTER_PCF);
    expect(occurrences(chunk, FILTER_PCF)).toBe(1);
    expect(filter).toBeGreaterThan(chunk.indexOf('#ifdef USE_SHADOWMAP'));
    expect(filter).toBeLessThan(chunk.indexOf('#if NUM_SUN_LIGHT_SHADOWS > 0'));
  });
});

describe('installSoftShadowFilter', () => {
  it('puts the filter in three’s chunk and is true', () => {
    expect(installSoftShadowFilter()).toBe(true);
    expect(THREE.ShaderChunk[CHUNK]).toContain(FILTER_PCF);
  });

  it('changes nothing in three’s chunk but the filter it inserts', () => {
    installSoftShadowFilter();
    expect(insertion(threeChunk, THREE.ShaderChunk[CHUNK])).toContain(FILTER_PCF);
  });

  it('gives every lit built-in material the framebuffer height the filter reads', () => {
    installSoftShadowFilter();
    expect(THREE.ShaderLib.standard.uniforms[FRAMEBUFFER_HEIGHT_UNIFORM]!.value).toBe(
      installedFramebufferHeight()
    );
    expect(THREE.ShaderLib.basic.uniforms[FRAMEBUFFER_HEIGHT_UNIFORM]).toBeUndefined();
  });

  it('declares the filter once, and warns nothing, when called twice (edge case)', () => {
    installSoftShadowFilter();
    expect(warningsOf(installSoftShadowFilter)).toEqual([]);
    expect(occurrences(THREE.ShaderChunk[CHUNK], FILTER_PCF)).toBe(1);
  });

  it('leaves a chunk it cannot patch alone, and is false (error case)', () => {
    THREE.ShaderChunk[CHUNK] = 'void main() {}';
    let installed = true;
    const warnings = warningsOf(() => {
      installed = installSoftShadowFilter();
    });
    expect(installed).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(THREE.ShaderChunk[CHUNK]).toBe('void main() {}');
    expect(THREE.ShaderLib.standard.uniforms[FRAMEBUFFER_HEIGHT_UNIFORM]).toBeUndefined();
  });
});

describe('the filter’s raw depth read', () => {
  it('is the clamped bilinear read the volumetric fog shares', () => {
    installSoftShadowFilter();
    const read = clampedBilinearDepthGlsl('godotRawDepth', 'godotRawDepthAt');
    expect(installedChunk()).toContain(read);
    expect(read).toContain('clamp( uv, 0.0, 1.0 )');
    expect(read).toContain('clamp( corner + ivec2( 1, 1 ), ivec2( 0 ), last )');
    expect(read.match(/godotRawDepthAt\(/g)).toHaveLength(4);
  });
});
