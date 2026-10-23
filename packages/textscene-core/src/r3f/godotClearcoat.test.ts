/**
 * Godot's clearcoat rides three's physical lighting chunks and its physical fragment shader. The
 * tests read the installed three, so a release that rewrites a replaced line fails here, not in a
 * golden.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installGodotClearcoat } from './godotClearcoat';
import { restoreShaderGlobalsAfterEach } from './testing/shaderPatches';
import { warningsOf } from './testing/logWarnings';
import { functionBody } from './testing/glslSource';

const threeFragment = THREE.ShaderLib.physical.fragmentShader;

restoreShaderGlobalsAfterEach();

/** The clearcoat block of the physical fragment shader. */
function clearcoatLayer(): string {
  installGodotClearcoat();
  const fragment = THREE.ShaderLib.physical.fragmentShader;
  return fragment.slice(fragment.lastIndexOf('#ifdef USE_CLEARCOAT')).split('#include <opaque_fragment>')[0]!;
}

describe('installGodotClearcoat', () => {
  it("reads the coat's raw roughness, with no floor and no geometry roughness", () => {
    installGodotClearcoat();
    const setup = THREE.ShaderChunk.lights_physical_fragment;

    expect(setup).not.toContain('material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );');
    expect(setup).not.toContain('material.clearcoatRoughness += geometryRoughness;');
  });

  it("draws the coat's lobe under a light with Godot's D, G and F", () => {
    installGodotClearcoat();
    const lobe = functionBody(THREE.ShaderChunk.lights_physical_pars_fragment, 'float godotClearcoatBRDF');

    expect(lobe).toContain('godotGGXDistribution( ccNdotH, mix( 0.001, 0.1, roughness ) )');
    expect(lobe).toContain('0.25 / ( cLdotH * cLdotH + 1e-4 )');
    expect(lobe).toContain('mix( 0.04, 1.0, godotSchlickFresnel( cLdotH ) )');
  });

  it("widens the coat's L.H and N.H by the light's size, as Godot does", () => {
    installGodotClearcoat();
    const pars = THREE.ShaderChunk.lights_physical_pars_fragment;
    const lobe = functionBody(pars, 'float godotClearcoatBRDF');

    expect(lobe).toContain('float cLdotH = saturate( sizeOffset + dot( lightDir, halfDir ) );');
    expect(lobe).toContain('float ccNdotH = saturate( sizeOffset + dot( normal, halfDir ) );');
    expect(pars).toContain('material.clearcoatRoughness, godotSizeOffset )');
  });

  it("weighs the coat's lobe by the surface's N.L, as Godot does", () => {
    installGodotClearcoat();
    const direct = THREE.ShaderChunk.lights_physical_pars_fragment.split('void RE_Direct_Physical(')[1]!;

    expect(direct).toContain('clearcoatSpecularDirect += irradiance * godotClearcoatBRDF(');
    expect(direct).not.toContain('BRDF_GGX_Clearcoat(');
  });

  it("scales the coat's lobe by the light's specular amount", () => {
    installGodotClearcoat();

    expect(THREE.ShaderChunk.lights_physical_pars_fragment).toContain(
      'material.clearcoatRoughness, godotSizeOffset ) * godotSpecularAmount;'
    );
  });

  it("reflects the sky on the coat about the coat's normal, below the surface's horizon", () => {
    installGodotClearcoat();

    expect(THREE.ShaderChunk.lights_fragment_maps).toContain(
      'clearcoatRadiance += godotClearcoatRadiance( geometryViewDir, geometryClearcoatNormal, geometryNormal, material.clearcoatRoughness );'
    );
    expect(
      functionBody(THREE.ShaderChunk.envmap_physical_pars_fragment, 'vec3 godotClearcoatRadiance')
    ).toContain('godotReflection( viewDir, clearcoatNormal, normal, roughness, horizon );');
  });

  it("reads the coat's reflection from the radiance and layer 1, as its layer is below 1", () => {
    installGodotClearcoat();

    expect(
      functionBody(THREE.ShaderChunk.envmap_physical_pars_fragment, 'vec3 godotClearcoatRadiance')
    ).toContain(
      'godotSkyLayer( reflectVec, pow2( mix( 0.001, 0.1, sqrt( roughness ) ) ) ) * horizon * horizon'
    );
  });

  it("dims the reflection by the coat's Fresnel and adds the coat's, before the base layer weighs both", () => {
    installGodotClearcoat();
    const end = THREE.ShaderChunk.lights_fragment_end;

    expect(end.indexOf('radiance = mix( radiance, clearcoatRadiance, godotCoatFresnel );')).toBeLessThan(
      end.indexOf('RE_IndirectSpecular(')
    );
    expect(THREE.ShaderChunk.lights_physical_pars_fragment).not.toContain('clearcoatSpecularIndirect +=');
  });

  it("dims the ambient light by the coat's Fresnel before any light reads it", () => {
    installGodotClearcoat();
    const beforeIndirect = THREE.ShaderChunk.lights_fragment_end.split('RE_IndirectDiffuse(')[0];

    expect(beforeIndirect).toContain('irradiance *= 1.0 - godotCoatFresnel;');
    expect(beforeIndirect).toContain('iblIrradiance *= 1.0 - godotCoatFresnel;');
  });

  it('dims nothing without a sky reflection, as Godot does (edge case)', () => {
    installGodotClearcoat();
    const end = THREE.ShaderChunk.lights_fragment_end;

    expect(end.match(/#if defined\( USE_CLEARCOAT \) && defined\( USE_ENVMAP \)/g)).toHaveLength(1);
  });

  it("adds the coat's lobe and dims no light beneath it in the layering", () => {
    const layer = clearcoatLayer();

    expect(layer).toContain('outgoingLight += clearcoatSpecularDirect * material.clearcoat;');
    expect(layer).not.toContain('Fcc');
  });

  it('installs the light function and the sky lighting it calls first', () => {
    installGodotClearcoat();

    expect(THREE.ShaderChunk.lights_physical_pars_fragment).toContain('float godotSchlickFresnel(');
    expect(THREE.ShaderChunk.envmap_physical_pars_fragment).toContain('vec3 godotIBLRadiance(');
  });

  it('leaves three alone when a patch it calls cannot install, and warns (error case)', () => {
    THREE.ShaderChunk.envmap_physical_pars_fragment = 'void main() {}';

    expect(warningsOf(installGodotClearcoat)).toHaveLength(1);
    expect(THREE.ShaderChunk.lights_physical_pars_fragment).not.toContain('godotClearcoatBRDF(');
    expect(THREE.ShaderLib.physical.fragmentShader).toBe(threeFragment);
  });

  it('leaves the chunks and the fragment shader alone when the shader lacks a replaced line, and warns (error case)', () => {
    THREE.ShaderLib.physical.fragmentShader = 'void main() {}';

    expect(warningsOf(installGodotClearcoat)).toHaveLength(1);
    expect(THREE.ShaderLib.physical.fragmentShader).toBe('void main() {}');
    expect(THREE.ShaderChunk.lights_physical_pars_fragment).not.toContain('godotClearcoatBRDF(');
  });

  it('changes nothing and warns nothing on a second call (edge case)', () => {
    installGodotClearcoat();
    const chunks = { ...THREE.ShaderChunk };
    const fragment = THREE.ShaderLib.physical.fragmentShader;

    expect(warningsOf(installGodotClearcoat)).toEqual([]);
    expect({ ...THREE.ShaderChunk }).toEqual(chunks);
    expect(THREE.ShaderLib.physical.fragmentShader).toBe(fragment);
  });
});
