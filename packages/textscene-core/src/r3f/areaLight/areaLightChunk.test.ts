/**
 * Godot's area light rides three's rect area light chunks. The tests read the installed three, so a
 * release that rewrites a replaced text fails here, not in a golden.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installGodotAreaLight } from './areaLightChunk';
import { installGodotLightFunction } from '../godotLightFunction';
import { installGodotLightSpecular } from '../lightSpecular/lightSpecularChunk';
import { installGodotLightSize } from '../lightSize/lightSizeChunk';
import { installGodotLightAttenuation } from '../godotLightAttenuation';
import { ltcTables } from '../../godot/ltc';
import { warningsOf } from '../testing/logWarnings';
import { functionBody, preprocessorBranch } from '../testing/glslSource';
import type { AreaLightChunkName } from './areaLightChunk';

const threeChunks = { ...THREE.ShaderChunk };

afterEach(() => {
  Object.assign(THREE.ShaderChunk, threeChunks);
});

/** The patches the area light reads, then the area light, as `installShaderPatches` orders them. */
function installWithItsPrerequisites(): void {
  installGodotLightSpecular();
  installGodotLightSize();
  installGodotLightFunction();
  installGodotLightAttenuation();
  installGodotAreaLight();
}

function patchedChunk(name: AreaLightChunkName): string {
  installWithItsPrerequisites();
  return THREE.ShaderChunk[name];
}

function areaLightBody(): string {
  return functionBody(patchedChunk('lights_physical_pars_fragment'), 'void RE_Direct_RectArea_Physical');
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

  it("dims both terms by the light's shadow, from the lookup the positional shadows install", () => {
    const area = areaLightBody();
    expect(area).toMatch(
      /vec3 ltcLight = light \* lightDistance \* lightDistance;\s*light \*= shadow;\s*ltcLight \*= shadow;/
    );
    expect(patchedChunk('lights_fragment_begin')).toContain(
      'rectAreaLightTextureMipmaps[ i ], receiveShadow ? GODOT_AREA_SHADOW( UNROLLED_LOOP_INDEX ) : 1.0, geometryPosition,'
    );
  });

  it('reads every light as lit when no lookup is installed (edge case)', () => {
    expect(patchedChunk('lights_fragment_begin')).toMatch(
      /#ifndef GODOT_AREA_SHADOW\s*#define GODOT_AREA_SHADOW\( index \) 1\.0\s*#endif\s*#if \( NUM_RECT_AREA_LIGHTS > 0 \)/
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
    expect(areaLightBody()).toContain('if ( falloff.x > 0.0 && lightDistance >= falloff.x ) return;');
  });

  it("reads the specular lobe at Godot's limited roughness", () => {
    expect(areaLightBody()).toContain(
      'godotLtcSpecular( geometryNormal, geometryViewDir, material.godotRoughness, points, textureRect, textureMipmaps, ltcFresnel, specularTexture );'
    );
  });

  it("hands each light its texture's rectangle and mips, by the light's index", () => {
    expect(patchedChunk('lights_fragment_begin')).toContain(
      'rectAreaLightTextureRects[ i ], rectAreaLightTextureMipmaps[ i ],'
    );
    expect(patchedChunk('lights_pars_begin')).toContain(
      'uniform vec4 rectAreaLightTextureRects[ NUM_RECT_AREA_LIGHTS ];'
    );
  });

  it("colours the diffuse by the light's texture where the diffuse integral sees it", () => {
    const area = areaLightBody();

    expect(area).toContain(
      'godotLtcIntegral( geometryNormal, geometryViewDir, mat3( 1.0 ), points, textureRect, textureMipmaps, diffuseTexture );'
    );
    expect(area).toContain('reflectedLight.directDiffuse += diffuse * diffuseTexture * ltcLight');
  });

  it("colours the specular by the light's texture where the lobe sees it", () => {
    expect(areaLightBody()).toContain('specular * specularTexture * fresnel * ltcLight');
  });

  it("colours the toon diffuse by the texture at the light's closest point", () => {
    const toon = preprocessorBranch(areaLightBody(), '#ifdef GODOT_DIFFUSE_TOON');

    expect(toon).toContain(
      'vec2 closestUv = ( closest.xy + vec2( halfWidthLength, halfHeightLength ) ) / vec2( widthLength, heightLength );'
    );
    expect(toon).toContain('light * isotropicTexture * area');
  });

  it("colours the toon specular by the specular's texture", () => {
    const toon = preprocessorBranch(areaLightBody(), '#if defined( GODOT_SPECULAR_TOON )');

    expect(toon).toContain('intensity * specularTexture * light');
  });

  it("colours the clearcoat's specular by the texture its lobe sees", () => {
    expect(preprocessorBranch(areaLightBody(), '#ifdef USE_CLEARCOAT')).toContain(
      'clearcoatSpecular * clearcoatTexture * clearcoatFresnel * ltcLight'
    );
  });

  it("draws a toon diffuse from the light's front and back integrals over its solid angle", () => {
    const toon = preprocessorBranch(areaLightBody(), '#ifdef GODOT_DIFFUSE_TOON');

    expect(toon).toContain(
      'godotLtcIntegral( - geometryNormal, geometryViewDir, mat3( 1.0 ), points, vec4( 0.0 ), textureMipmaps, backTexture );'
    );
    expect(toon).toContain('( diffuse - backDiffuse ) / solidAngleOverPi');
    expect(toon).toContain('godotDiffuseNL( NdotL, 0.0, 0.0, material.godotRoughness )');
    expect(toon).toContain(
      'light * isotropicTexture * area * clearcoatAttenuation * material.diffuseContribution'
    );
  });

  it("writes a toon specular into the light's diffuse, as Godot does", () => {
    const toon = preprocessorBranch(areaLightBody(), '#if defined( GODOT_SPECULAR_TOON )');

    expect(toon).toContain('godotToonIntensity( specular / solidAngleOverPi, material.godotRoughness )');
    expect(toon).toContain('reflectedLight.directDiffuse +=');
    expect(toon).not.toContain('directSpecular');
  });

  it('reads no specular lobe when the specular mode is disabled', () => {
    const area = areaLightBody();

    expect(preprocessorBranch(area, '#ifndef GODOT_SPECULAR_DISABLED')).toContain('godotLtcSpecular(');
    expect(preprocessorBranch(area, '#elif !defined( GODOT_SPECULAR_DISABLED )')).toContain(
      'reflectedLight.directSpecular +='
    );
  });

  it("dims the light's diffuse and specular by the clearcoat's own Fresnel", () => {
    const area = areaLightBody();

    expect(preprocessorBranch(area, '#ifdef USE_CLEARCOAT')).toContain(
      'clearcoatAttenuation = 1.0 - clearcoatFresnel * material.clearcoat;'
    );
    expect(area).toContain(
      'reflectedLight.directDiffuse += diffuse * diffuseTexture * ltcLight * clearcoatAttenuation'
    );
    expect(area).toContain('specularAmount * clearcoatAttenuation;');
  });

  it('declares the area light after the light function terms it calls', () => {
    const chunk = patchedChunk('lights_physical_pars_fragment');
    const areaLight = chunk.indexOf('void RE_Direct_RectArea_Physical(');

    expect(chunk.indexOf('float godotDiffuseNL(')).toBeLessThan(areaLight);
    expect(chunk.indexOf('float godotToonIntensity(')).toBeLessThan(areaLight);
  });

  it("drops three's area light block whole (edge case)", () => {
    expect(patchedChunk('lights_physical_pars_fragment').match(/#if NUM_RECT_AREA_LIGHTS > 0/g)).toHaveLength(
      1
    );
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
    installGodotLightSpecular();
    installGodotLightSize();
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
