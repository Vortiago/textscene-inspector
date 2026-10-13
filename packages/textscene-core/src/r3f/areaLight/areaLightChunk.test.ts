/**
 * Godot's area light rides three's rect area light chunks. The tests read the installed three, so a
 * release that rewrites a replaced text fails here, not in a golden.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installGodotAreaLight } from './areaLightChunk';
import { installGodotLightFunction } from '../godotLightFunction';
import { installGodotLightAttenuation } from '../godotLightAttenuation';
import { ltcTables } from '../../godot/ltc';
import { warningsOf } from '../testing/logWarnings';

type AreaLightChunkName = 'lights_pars_begin' | 'lights_physical_pars_fragment' | 'lights_fragment_begin';

const threeChunks = { ...THREE.ShaderChunk };

afterEach(() => {
  Object.assign(THREE.ShaderChunk, threeChunks);
});

/** The patches the area light reads, then the area light, as `installShaderPatches` orders them. */
function installWithItsPrerequisites(): void {
  installGodotLightFunction();
  installGodotLightAttenuation();
  installGodotAreaLight();
}

function patchedChunk(name: AreaLightChunkName): string {
  installWithItsPrerequisites();
  return THREE.ShaderChunk[name];
}

/** The body of the GLSL function `name` in `chunk`, between its braces. */
function functionBody(chunk: string, name: string): string {
  const open = chunk.indexOf('{', chunk.indexOf(`${name}(`)) + 1;
  return chunk.slice(open, chunk.indexOf('\n}', open));
}

function areaLightBody(): string {
  return functionBody(patchedChunk('lights_physical_pars_fragment'), 'void RE_Direct_RectArea_Physical');
}

/** The text of `area` from the line that opens `branch` to the next `#elif`, `#else` or `#endif`. */
function branch(area: string, opening: string): string {
  return area.split(opening)[1]!.split(/#el|#endif/)[0]!;
}

describe('installGodotAreaLight', () => {
  it("integrates the clipped rectangle's edges with Godot's fit, not three's clipped sphere", () => {
    const area = areaLightBody();

    expect(patchedChunk('lights_physical_pars_fragment')).toContain(
      '5.42031 + ( 3.12829 + 0.0902326 * y ) * y'
    );
    expect(area).toContain('godotLtcIntegral(');
    expect(area).not.toContain('LTC_Evaluate(');
  });

  it("weighs the specular by Godot's Fresnel and the light's specular amount", () => {
    const area = areaLightBody();

    expect(area).toContain('float f90 = clamp( dot( f0, vec3( 50.0 * 0.33 ) ), material.metalness, 1.0 );');
    expect(area).toContain('float specularAmount = falloff.z;');
  });

  it("hands each light its facing and falloff, by the light's index", () => {
    expect(patchedChunk('lights_fragment_begin')).toContain(
      'RE_Direct_RectArea( rectAreaLight, rectAreaLightFacings[ i ], rectAreaLightFalloffs[ i ],'
    );
    expect(patchedChunk('lights_pars_begin')).toContain(
      'uniform vec3 rectAreaLightFalloffs[ NUM_RECT_AREA_LIGHTS ];'
    );
  });

  it("fades with Godot's omni attenuation, times the squared distance for the integral", () => {
    const area = areaLightBody();

    expect(area).toContain(
      'rectAreaLight.color * getDistanceAttenuation( lightDistance, falloff.x, falloff.y );'
    );
    expect(area).toContain('vec3 ltcLight = light * lightDistance * lightDistance;');
  });

  it('skips a fragment at and past the range (edge case)', () => {
    expect(areaLightBody()).toContain('if ( lightDistance >= falloff.x ) return;');
  });

  it("reads the specular lobe at Godot's limited roughness", () => {
    expect(areaLightBody()).toContain(
      'godotLtcSpecular( geometryNormal, geometryViewDir, material.godotRoughness, points, ltcFresnel );'
    );
  });

  it("draws a toon diffuse from the light's front and back integrals over its solid angle", () => {
    const toon = branch(areaLightBody(), '#ifdef GODOT_DIFFUSE_TOON');

    expect(toon).toContain('godotLtcIntegral( - geometryNormal, geometryViewDir, mat3( 1.0 ), points );');
    expect(toon).toContain('( diffuse - backDiffuse ) / solidAngleOverPi');
    expect(toon).toContain('light * area * clearcoatAttenuation * material.diffuseContribution');
  });

  it("writes a toon specular into the light's diffuse, as Godot does", () => {
    const toon = branch(areaLightBody(), '#if defined( GODOT_SPECULAR_TOON )');

    expect(toon).toContain('reflectedLight.directDiffuse +=');
    expect(toon).not.toContain('directSpecular');
  });

  it('reads no specular lobe when the specular mode is disabled', () => {
    const area = areaLightBody();

    expect(branch(area, '#ifndef GODOT_SPECULAR_DISABLED')).toContain('godotLtcSpecular(');
    expect(branch(area, '#elif !defined( GODOT_SPECULAR_DISABLED )')).toContain(
      'reflectedLight.directSpecular +='
    );
  });

  it("dims the light's diffuse and specular by the clearcoat's own Fresnel", () => {
    const area = areaLightBody();

    expect(branch(area, '#ifdef USE_CLEARCOAT')).toContain(
      'clearcoatAttenuation = 1.0 - clearcoatFresnel * material.clearcoat;'
    );
    expect(area).toContain('reflectedLight.directDiffuse += diffuse * ltcLight * clearcoatAttenuation');
    expect(area).toContain('specularAmount * clearcoatAttenuation;');
  });

  it("samples Godot's LTC tables in place of three's", () => {
    installWithItsPrerequisites();
    const { lut1, lut2 } = ltcTables();
    const uniforms = THREE.UniformsLib as unknown as Record<string, THREE.DataTexture>;

    expect(uniforms.LTC_FLOAT_1!.image.data).toEqual(lut1);
    expect(uniforms.LTC_FLOAT_2!.image.data).toEqual(lut2);
    expect(uniforms.LTC_HALF_1!.image.data).toEqual(
      new Uint16Array(Array.from(lut1, THREE.DataUtils.toHalfFloat))
    );
  });

  it('leaves the chunks alone when one lacks a replaced text, and warns (error case)', () => {
    installGodotLightFunction();
    installGodotLightAttenuation();
    const lightFunction = THREE.ShaderChunk.lights_physical_pars_fragment;
    THREE.ShaderChunk.lights_fragment_begin = 'void main() {}';

    expect(warningsOf(installGodotAreaLight)).toHaveLength(1);
    expect(THREE.ShaderChunk.lights_fragment_begin).toBe('void main() {}');
    expect(THREE.ShaderChunk.lights_physical_pars_fragment).toBe(lightFunction);
  });

  it("leaves three's area light alone before the light function it reads, and warns (error case)", () => {
    installGodotLightAttenuation();

    expect(warningsOf(installGodotAreaLight)).toHaveLength(1);
    expect(THREE.ShaderChunk.lights_physical_pars_fragment).toBe(threeChunks.lights_physical_pars_fragment);
  });

  it('changes nothing and warns nothing on a second call (edge case)', () => {
    const once = patchedChunk('lights_physical_pars_fragment');

    expect(warningsOf(installGodotAreaLight)).toEqual([]);
    expect(THREE.ShaderChunk.lights_physical_pars_fragment).toBe(once);
  });
});
