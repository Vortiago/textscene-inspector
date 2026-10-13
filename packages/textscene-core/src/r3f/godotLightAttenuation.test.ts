/**
 * Godot's light attenuation rides three's own lines in `lights_pars_begin`. A three release that
 * rewrites one fails here, not silently in a capture.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { godotConePenumbra, installGodotLightAttenuation } from './godotLightAttenuation';
import { warningsOf } from './testing/logWarnings';

const threeChunk = THREE.ShaderChunk.lights_pars_begin;

afterEach(() => {
  THREE.ShaderChunk.lights_pars_begin = threeChunk;
});

function patchedChunk(): string {
  installGodotLightAttenuation();
  return THREE.ShaderChunk.lights_pars_begin;
}

/** The cone exponent the patched chunk reads from a light `angle` radians wide. */
function carriedExponent(angle: number, angleAttenuation: number): number {
  const cosine = Math.cos(angle * (1 - godotConePenumbra(angle, angleAttenuation)));
  return -cosine / Math.sqrt(1 - cosine * cosine);
}

describe('installGodotLightAttenuation', () => {
  it("falls off with Godot's distance curve, clamped at Godot's distance", () => {
    expect(patchedChunk()).toContain(
      'float distanceFalloff = pow( max( lightDistance, 0.0001 ), - decayExponent );'
    );
  });

  it("fades a spot light's cone with Godot's power of the rim", () => {
    const chunk = patchedChunk();

    expect(chunk).toContain('( 1.0 - max( angleCosine, coneCosine ) ) / ( 1.0 - coneCosine )');
    expect(chunk).toContain('return 1.0 - pow( rim, exponent );');
    expect(chunk).not.toContain('smoothstep( coneCosine, penumbraCosine, angleCosine )');
  });

  it('keeps the negative light of a negative cone exponent (edge case)', () => {
    expect(patchedChunk()).toContain('if ( spotAttenuation != 0.0 ) {');
  });

  it('leaves the chunk alone when it lacks a line, and warns (error case)', () => {
    THREE.ShaderChunk.lights_pars_begin = threeChunk.replace('smoothstep', 'mix');

    expect(warningsOf(installGodotLightAttenuation)).toHaveLength(1);
    expect(THREE.ShaderChunk.lights_pars_begin).toBe(threeChunk.replace('smoothstep', 'mix'));
  });

  it('changes nothing and warns nothing on a second call (edge case)', () => {
    const once = patchedChunk();

    expect(warningsOf(installGodotLightAttenuation)).toEqual([]);
    expect(THREE.ShaderChunk.lights_pars_begin).toBe(once);
  });
});

describe('godotConePenumbra', () => {
  it('carries the inverse of spot_angle_attenuation as the cone exponent', () => {
    expect(carriedExponent(Math.PI / 4, 2)).toBeCloseTo(0.5, 10);
    expect(carriedExponent(0.1, 0.25)).toBeCloseTo(4, 8);
  });

  it('carries a negative exponent (edge case)', () => {
    expect(carriedExponent(Math.PI / 4, -2)).toBeCloseTo(-0.5, 10);
  });

  it("carries a zero attenuation's infinite exponent as a cosine of -1 (edge case)", () => {
    const angle = Math.PI / 4;
    expect(Math.cos(angle * (1 - godotConePenumbra(angle, 0)))).toBeCloseTo(-1, 10);
  });

  it('gives a cone of no width no penumbra (edge case)', () => {
    expect(godotConePenumbra(0, 1)).toBe(0);
  });
});
