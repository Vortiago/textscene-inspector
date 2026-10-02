/**
 * The filter is checked against the installed three's shadow chunk, so a release that rewrites the
 * sun block it precedes fails here and not in a golden.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SOFT_LOW_SHADOW_SAMPLES, vogelDisk } from '../../godot/softShadowKernel';
import { FRAMEBUFFER_HEIGHT_UNIFORM, framebufferHeight } from './framebufferRows';
import { SOFT_SHADOW_FILTER, installSoftShadowFilter, softShadowFilterChunk } from './softShadowFilter';
import { warningsOf } from '../testing/logWarnings';

const CHUNK = 'shadowmap_pars_fragment';
const threeChunk = THREE.ShaderChunk[CHUNK];

const occurrences = (text: string, part: string) => text.split(part).length - 1;

afterEach(() => {
  THREE.ShaderChunk[CHUNK] = threeChunk;
  for (const shader of Object.values(THREE.ShaderLib)) delete shader.uniforms[FRAMEBUFFER_HEIGHT_UNIFORM];
  delete (THREE.UniformsLib.lights as Record<string, THREE.IUniform>)[FRAMEBUFFER_HEIGHT_UNIFORM];
});

/** The float literals of the kernel the GLSL declares. */
function kernelLiterals(): number[] {
  const kernel = /GODOT_SOFT_SHADOW_KERNEL\[ \d+ \] = vec2\[\]\((.*)\);/.exec(SOFT_SHADOW_FILTER)![1]!;
  return [...kernel.matchAll(/vec2\( (\S+), (\S+) \)/g)].flatMap((match) => [
    Number(match[1]),
    Number(match[2]),
  ]);
}

describe('the soft shadow filter', () => {
  it('declares Godot’s Soft Low kernel, each tap the float Godot stores', () => {
    expect(kernelLiterals()).toEqual(vogelDisk(SOFT_LOW_SHADOW_SAMPLES).flat());
  });

  it('takes every tap of the kernel and averages them', () => {
    expect(SOFT_SHADOW_FILTER).toContain(`const int GODOT_SOFT_SHADOW_SAMPLES = ${SOFT_LOW_SHADOW_SAMPLES};`);
    expect(SOFT_SHADOW_FILTER).toContain('for ( int i = 0; i < GODOT_SOFT_SHADOW_SAMPLES; i ++ )');
    expect(SOFT_SHADOW_FILTER).toContain('return shadow * ( 1.0 / float( GODOT_SOFT_SHADOW_SAMPLES ) );');
  });

  it('turns the kernel by quick_hash of the fragment, rows counted from the top', () => {
    expect(SOFT_SHADOW_FILTER).toContain(
      'vec2 fragCoord = vec2( gl_FragCoord.x, godotFramebufferHeight[ 0 ] - gl_FragCoord.y );'
    );
    expect(SOFT_SHADOW_FILTER).toContain(
      'fract( 52.9829189 * fract( dot( fragCoord, vec2( 0.06711056, 0.00583715 ) ) ) ) * PI2'
    );
    expect(SOFT_SHADOW_FILTER).toContain('return mat2( vec2( cr, - sr ), vec2( sr, cr ) );');
  });

  it('writes every kernel value as a float GLSL accepts (edge case)', () => {
    const kernel = /vec2\[\]\((.*)\);/.exec(SOFT_SHADOW_FILTER)![1]!;
    expect(kernel).not.toMatch(/[(, ]-?\d+ [,)]/);
  });
});

describe('softShadowFilterChunk', () => {
  it('declares the filter once, inside the shadow block and ahead of every shadow type', () => {
    const patched = softShadowFilterChunk(threeChunk)!;
    const filter = patched.indexOf(SOFT_SHADOW_FILTER);
    expect(occurrences(patched, SOFT_SHADOW_FILTER)).toBe(1);
    expect(filter).toBeGreaterThan(patched.indexOf('#ifdef USE_SHADOWMAP'));
    expect(filter).toBeLessThan(patched.indexOf('#if NUM_SUN_LIGHT_SHADOWS > 0'));
  });

  it('changes nothing but the filter', () => {
    expect(softShadowFilterChunk(threeChunk)!.replace(SOFT_SHADOW_FILTER, '')).toBe(threeChunk);
  });

  it('is null for a chunk without the sun block (error case)', () => {
    expect(softShadowFilterChunk('void main() {}')).toBeNull();
  });
});

describe('installSoftShadowFilter', () => {
  it('puts the filter in three’s chunk and is true', () => {
    expect(installSoftShadowFilter()).toBe(true);
    expect(THREE.ShaderChunk[CHUNK]).toBe(softShadowFilterChunk(threeChunk));
  });

  it('gives every lit built-in material the framebuffer height the filter reads', () => {
    installSoftShadowFilter();
    expect(THREE.ShaderLib.standard.uniforms[FRAMEBUFFER_HEIGHT_UNIFORM]!.value).toBe(framebufferHeight);
    expect(THREE.ShaderLib.basic.uniforms[FRAMEBUFFER_HEIGHT_UNIFORM]).toBeUndefined();
  });

  it('declares the filter once, and warns nothing, when called twice (edge case)', () => {
    installSoftShadowFilter();
    expect(warningsOf(installSoftShadowFilter)).toEqual([]);
    expect(occurrences(THREE.ShaderChunk[CHUNK], SOFT_SHADOW_FILTER)).toBe(1);
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
