/**
 * Godot's area light rides three's rect area light chunks. The tests read the installed three, so a
 * release that rewrites a replaced text fails here, not in a golden.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installGodotAreaLight } from './areaLightChunk';
import { ltcTables } from '../../godot/ltc';
import { warningsOf } from '../testing/logWarnings';

const NAMES = ['lights_pars_begin', 'lights_physical_pars_fragment', 'lights_fragment_begin'] as const;
const threeChunks = Object.fromEntries(NAMES.map((name) => [name, THREE.ShaderChunk[name]]));

afterEach(() => {
  Object.assign(THREE.ShaderChunk, threeChunks);
});

function patchedChunk(name: (typeof NAMES)[number]): string {
  installGodotAreaLight();
  return THREE.ShaderChunk[name];
}

/** The body of the GLSL function `name` in `chunk`, between its braces. */
function functionBody(chunk: string, name: string): string {
  const open = chunk.indexOf('{', chunk.indexOf(`${name}(`)) + 1;
  return chunk.slice(open, chunk.indexOf('\n}', open));
}

/** The patched chunk's distance attenuation, run on the CPU. Every local it declares is a float. */
function attenuation(distance: number, range: number, decay: number): number {
  const body = functionBody(patchedChunk('lights_physical_pars_fragment'), 'float godotAreaAttenuation');
  const run = new Function(
    'lightDistance',
    'inverseRange',
    'decay',
    'max',
    'pow',
    body.replace(/\bfloat\s+(?=\w+\s*=)/g, 'let ')
  ) as (...args: unknown[]) => number;
  return run(distance, 1 / range, decay, Math.max, Math.pow);
}

describe('installGodotAreaLight', () => {
  it("integrates the clipped rectangle's edges with Godot's fit, not three's clipped sphere", () => {
    const area = functionBody(
      patchedChunk('lights_physical_pars_fragment'),
      'void RE_Direct_RectArea_Physical'
    );

    expect(patchedChunk('lights_physical_pars_fragment')).toContain(
      '5.42031 + ( 3.12829 + 0.0902326 * y ) * y'
    );
    expect(area).toContain('godotLtcIntegral(');
    expect(area).not.toContain('LTC_Evaluate(');
  });

  it("weighs the specular by Godot's Fresnel and the light's specular amount", () => {
    const area = functionBody(
      patchedChunk('lights_physical_pars_fragment'),
      'void RE_Direct_RectArea_Physical'
    );

    expect(area).toContain('float f90 = clamp( dot( f0, vec3( 50.0 * 0.33 ) ), material.metalness, 1.0 );');
    expect(area).toContain('falloff.z');
  });

  it("hands each light its facing and falloff, by the light's index", () => {
    expect(patchedChunk('lights_fragment_begin')).toContain(
      'RE_Direct_RectArea( rectAreaLight, rectAreaLightFacings[ i ], rectAreaLightFalloffs[ i ],'
    );
    expect(patchedChunk('lights_pars_begin')).toContain(
      'uniform vec3 rectAreaLightFalloffs[ NUM_RECT_AREA_LIGHTS ];'
    );
  });

  it("fades with Godot's range window times the distance to the power 2 - attenuation", () => {
    // ( max( 1 - ( d / 5 )^4, 0 ) )^2 * d^( 2 - attenuation ).
    expect(attenuation(1, 5, 1)).toBeCloseTo(0.99680256, 6);
    expect(attenuation(2, 5, 1)).toBeCloseTo(1.89891072, 6);
    expect(attenuation(4, 5, 1)).toBeCloseTo(1.39428864, 6);
    expect(attenuation(1, 5, 2)).toBeCloseTo(0.99680256, 6);
    expect(attenuation(2, 5, 2)).toBeCloseTo(0.94945536, 6);
    expect(attenuation(4, 5, 2)).toBeCloseTo(0.34857216, 6);
  });

  it('gives nothing at and past the range, and nothing on the rectangle (edge case)', () => {
    expect(attenuation(5, 5, 1)).toBe(0);
    expect(attenuation(6, 5, 1)).toBe(0);
    expect(attenuation(0, 5, 1)).toBe(0);
  });

  it("samples Godot's LTC tables in place of three's", () => {
    installGodotAreaLight();
    const { lut1, lut2 } = ltcTables();
    const uniforms = THREE.UniformsLib as unknown as Record<string, THREE.DataTexture>;

    expect(uniforms.LTC_FLOAT_1!.image.data).toEqual(lut1);
    expect(uniforms.LTC_FLOAT_2!.image.data).toEqual(lut2);
    expect(uniforms.LTC_HALF_1!.image.data).toEqual(
      new Uint16Array(Array.from(lut1, THREE.DataUtils.toHalfFloat))
    );
  });

  it('leaves the chunks alone when one lacks a replaced text, and warns (error case)', () => {
    THREE.ShaderChunk.lights_fragment_begin = 'void main() {}';

    expect(warningsOf(installGodotAreaLight)).toHaveLength(1);
    expect(THREE.ShaderChunk.lights_fragment_begin).toBe('void main() {}');
    expect(THREE.ShaderChunk.lights_physical_pars_fragment).toBe(threeChunks.lights_physical_pars_fragment);
  });

  it('changes nothing and warns nothing on a second call (edge case)', () => {
    const once = patchedChunk('lights_physical_pars_fragment');

    expect(warningsOf(installGodotAreaLight)).toEqual([]);
    expect(THREE.ShaderChunk.lights_physical_pars_fragment).toBe(once);
  });
});
