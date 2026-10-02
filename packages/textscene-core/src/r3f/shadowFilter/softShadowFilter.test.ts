import { describe, expect, it } from 'vitest';
import { SOFT_LOW_SHADOW_SAMPLES, vogelDisk } from '../../godot/softShadowKernel';
import { SOFT_SHADOW_FILTER, glslFloat } from './softShadowFilter';

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

  it('declares itself once in a program that holds it twice (edge case)', () => {
    const lines = SOFT_SHADOW_FILTER.trim().split('\n');
    expect(lines[0]!.trim()).toBe('#ifndef GODOT_SOFT_SHADOW_FILTER');
    expect(lines[1]!.trim()).toBe('#define GODOT_SOFT_SHADOW_FILTER');
    expect(lines.at(-1)!.trim()).toBe('#endif');
  });

  it('writes every kernel value as a float GLSL accepts (edge case)', () => {
    const kernel = /vec2\[\]\((.*)\);/.exec(SOFT_SHADOW_FILTER)![1]!;
    expect(kernel).not.toMatch(/[(, ]-?\d+ [,)]/);
  });
});

describe('glslFloat', () => {
  it('keeps a literal with a point or an exponent', () => {
    expect(glslFloat(0.25)).toBe('0.25');
    expect(glslFloat(1e-7)).toBe('1e-7');
  });

  it('gives an integer a point, which GLSL needs for a float (edge case)', () => {
    expect(glslFloat(4)).toBe('4.0');
    expect(glslFloat(-1)).toBe('-1.0');
  });
});
