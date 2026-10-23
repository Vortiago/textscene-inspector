/**
 * The Fresnel weight comes off three's diffuse term, a light's diffuse and specular follow the modes
 * a program defines, and the default specular is Godot's GGX on Godot's roughness. The chunks are
 * read as installed on the installed three, so a release that rewrites the lines fails here, not in
 * a golden.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { threeAnisotropy, installGodotLightFunction } from './godotLightFunction';
import { warningsOf } from './testing/logWarnings';
import { preprocessorBranch } from './testing/glslSource';
import { installedShaderChunks, restoreShaderGlobalsAfterEach } from './testing/shaderPatches';

const CHUNK = 'lights_physical_pars_fragment';
const SETUP_CHUNK = 'lights_physical_fragment';
const MAPS_CHUNK = 'lights_fragment_maps';
type LightChunk = typeof CHUNK | typeof SETUP_CHUNK | typeof MAPS_CHUNK;

/** The three chunks as `THREE.ShaderChunk` holds them now. */
function installedChunks(): Record<LightChunk, string> {
  return {
    [CHUNK]: THREE.ShaderChunk[CHUNK],
    [SETUP_CHUNK]: THREE.ShaderChunk[SETUP_CHUNK],
    [MAPS_CHUNK]: THREE.ShaderChunk[MAPS_CHUNK],
  };
}

const threeChunks = installedChunks();

/** The three chunks a canvas compiles with. */
const godotChunks = installedShaderChunks;

restoreShaderGlobalsAfterEach();

describe('the installed light function', () => {
  it("scales each specular mode by the light's specular amount", () => {
    const sum = godotChunks()[CHUNK].split('if ( material.godotRoughness <= 0.0 ) {')[1]!;
    expect(sum).toContain('* directLight.color * godotSpecularAmount * material.diffuseContribution;');
    expect(sum).toContain('specularBRDF *= godotSpecularAmount;');
  });

  it('drops the Fresnel weight from every diffuse line', () => {
    const patched = godotChunks()[CHUNK];
    expect(patched).not.toContain('* ( 1.0 - F )');
    expect(patched).not.toContain('* ( 1.0 - singleScattering - multiScattering )');
    expect(patched).not.toContain('* ( 1.0 - totalScatteringDielectric )');
  });

  it("defines Godot's light function before the direct light function calls it", () => {
    const patched = godotChunks()[CHUNK];
    expect(patched.indexOf('float godotDiffuseNL(')).toBeLessThan(
      patched.indexOf('void RE_Direct_Physical(')
    );
  });

  it("draws a light's specular with Godot's GGX", () => {
    // `scene_forward_lights_inc.glsl:239-262`.
    expect(godotChunks()[CHUNK].split('void RE_Direct_Physical(')[1]).toContain(
      'vec3 specularBRDF = godotSpecularBRDF( directLight.direction, geometryViewDir, geometryNormal, material, godotSizeOffset );'
    );
  });

  it("widens N.L, N.H and L.H by the light's size, as Godot does", () => {
    const chunk = godotChunks()[CHUNK];
    const specular = chunk.split('vec3 godotSpecularBRDF(')[1]!.split('return F * D * V;')[0]!;
    expect(specular).toContain('float cNdotL = saturate( sizeOffset + dot( normal, lightDir ) );');
    expect(specular).toContain('float cNdotH = saturate( sizeOffset + dot( normal, halfDir ) );');
    expect(specular).toContain('float cLdotH = saturate( sizeOffset + dot( lightDir, halfDir ) );');
    const direct = chunk.split('void RE_Direct_Physical(')[1]!;
    expect(direct).toContain(
      'float dotNL = saturate( godotSizeOffset + dot( geometryNormal, directLight.direction ) );'
    );
    expect(direct).toContain(
      'godotDiffuseNL( godotSizeOffset + dot( geometryNormal, directLight.direction ),'
    );
    expect(direct).toContain('saturate( godotSizeOffset + dotVH )');
  });

  it('draws no specular at roughness 0, as Godot does (edge case)', () => {
    // `scene_forward_lights_inc.glsl:222`.
    const direct = godotChunks()[CHUNK].split('void RE_Direct_Physical(')[1]!;
    expect(direct).toMatch(
      /if \( material\.godotRoughness <= 0\.0 \) \{\s*specularBRDF = vec3\( 0\.0 \);[\s\S]*\}\s*specularBRDF \*= godotSpecularAmount;\s*reflectedLight\.directSpecular \+=/
    );
  });

  it("writes a toon specular into the light's diffuse, as Godot does", () => {
    // `scene_forward_lights_inc.glsl:228-234`.
    const direct = godotChunks()[CHUNK].split('void RE_Direct_Physical(')[1]!;
    const toon = preprocessorBranch(direct, '#if defined( GODOT_SPECULAR_TOON )');
    expect(toon).toContain('specularBRDF = vec3( 0.0 );');
    expect(toon).toContain('reflectedLight.directDiffuse += godotToonSpecular(');
  });

  it('draws no specular when the specular mode is disabled', () => {
    // `scene_forward_lights_inc.glsl:236-237`.
    const disabled = godotChunks()[CHUNK].split('#elif defined( GODOT_SPECULAR_DISABLED )')[1]!;
    expect(disabled.split('#endif')[0]).toContain('specularBRDF = vec3( 0.0 );');
  });

  it("draws a retroreflective lobe with Godot's GGX, not three's", () => {
    expect(godotChunks()[CHUNK]).toContain(
      'vec3 retroSpecularBRDF = godotSpecularBRDF( directLight.direction, retroViewDir, geometryNormal, material, godotSizeOffset );'
    );
  });

  it('snaps a roughness below 1e-8 to 0, as Godot does (edge case)', () => {
    // `scene_forward_clustered.glsl:1667-1671`.
    expect(godotChunks()[SETUP_CHUNK]).toMatch(
      /material\.godotRoughness = sqrt\([^\n]*\);\nif \( material\.godotRoughness < 1e-8 \) material\.godotRoughness = 0\.0;/
    );
  });

  it("limits roughness by the normal map's paired texel difference, as a fine derivative takes it", () => {
    // `scene_forward_clustered.glsl:1660`; WebGL 2 has no `dFdxFine`.
    const mapped = preprocessorBranch(godotChunks()[SETUP_CHUNK], '#ifdef USE_NORMALMAP_TANGENTSPACE');
    expect(mapped).toContain('vec2 godotPair = 1.0 - 2.0 * mod( floor( gl_FragCoord.xy ), 2.0 );');
    expect(mapped).toContain(
      'godotDndu = godotPair.x * ( godotMapNormal( vNormalMapUv + godotPair.x * godotUvDx, godotUvDx, godotUvDy, tbn + godotPair.x * godotTbnDx ) - normal );'
    );
    expect(mapped).toContain(
      'godotDndv = godotPair.y * ( godotMapNormal( vNormalMapUv + godotPair.y * godotUvDy, godotUvDx, godotUvDy, tbn + godotPair.y * godotTbnDy ) - normal );'
    );
    expect(mapped).not.toContain('dFdx( normal )');
  });

  it('keeps the screen derivative of the normal when no tangent-space map perturbs it (edge case)', () => {
    const limiter = godotChunks()[SETUP_CHUNK].split('#ifdef USE_NORMALMAP_TANGENTSPACE')[1]!;
    const unmapped = preprocessorBranch(limiter, '#else');
    expect(unmapped).toContain('vec3 godotDndu = dFdx( normal );');
    expect(unmapped).toContain('vec3 godotDndv = dFdy( normal );');
  });

  it("stretches the anisotropic lobe by Godot's aspect ratio of its roughness", () => {
    // `scene_forward_lights_inc.glsl:241-245`.
    const setup = godotChunks()[SETUP_CHUNK];
    expect(setup).toContain('float godotAspect = sqrt( 1.0 - godotAnisotropy * 0.9 );');
    expect(setup).toContain('material.alphaT = pow2( material.godotRoughness ) / godotAspect;');
    expect(setup).toContain('material.godotAlphaB = pow2( material.godotRoughness ) * godotAspect;');
  });

  it('turns the frame by the flowmap only above 0.01, as Godot does (edge case)', () => {
    // `scene_forward_clustered.glsl:1456-1461`.
    expect(godotChunks()[SETUP_CHUNK]).toContain(
      'if ( godotAnisotropy <= 0.01 ) anisotropyV = vec2( 1.0, 0.0 );'
    );
  });

  it("bends a negative anisotropy's reflection about the tangent, as Godot does (edge case)", () => {
    // `scene_forward_clustered.glsl:1698`.
    expect(godotChunks()[CHUNK]).toContain(
      '#define GODOT_IBL_ANISOTROPIC_DIRECTION ( GODOT_ANISOTROPY_IS_NEGATIVE ? material.anisotropyT : material.anisotropyB )'
    );
    expect(godotChunks()[MAPS_CHUNK]).not.toContain('material.anisotropyB');
  });

  it("reflects an anisotropic surface on Godot's roughness, as its isotropic reflection does", () => {
    expect(godotChunks()[MAPS_CHUNK]).toContain(
      'getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.godotRoughness, '
    );
  });

  it('reads the sign off the frame that threeAnisotropy turns (edge case)', () => {
    expect(godotChunks()[CHUNK]).toContain(
      '#define GODOT_ANISOTROPY_IS_NEGATIVE ( anisotropyVector.x < 0.0 )'
    );
    expect(godotChunks()[SETUP_CHUNK]).toContain(
      'float godotAnisotropy = GODOT_ANISOTROPY_IS_NEGATIVE ? - material.anisotropy : material.anisotropy;'
    );
  });
});

describe('installGodotLightFunction', () => {
  it('writes Godot’s roughness and light function into all three chunks', () => {
    installGodotLightFunction();

    const patched = installedChunks();
    expect(patched[CHUNK]).toContain('float godotDiffuseNL(');
    expect(patched[SETUP_CHUNK]).toContain('material.godotRoughness = sqrt(');
    expect(patched[MAPS_CHUNK]).toContain('material.godotRoughness');
  });

  it('leaves a chunk it cannot patch alone, and warns (error case)', () => {
    THREE.ShaderChunk[CHUNK] = 'void main() {}';

    expect(warningsOf(installGodotLightFunction)).toHaveLength(1);

    expect(installedChunks()).toEqual({ ...threeChunks, [CHUNK]: 'void main() {}' });
  });

  it('leaves every chunk alone when the setup chunk lacks its roughness clamp (error case)', () => {
    THREE.ShaderChunk[SETUP_CHUNK] = 'void main() {}';
    const before = installedChunks();

    expect(warningsOf(installGodotLightFunction)).toHaveLength(1);

    expect(installedChunks()).toEqual(before);
  });

  it('changes nothing and warns nothing on a second call (edge case)', () => {
    installGodotLightFunction();
    const once = installedChunks();

    expect(warningsOf(installGodotLightFunction)).toEqual([]);
    expect(installedChunks()).toEqual(once);
  });

  it('installs the light specular, the light size and the normal map read it reads first', () => {
    installGodotLightFunction();

    expect(THREE.ShaderChunk.lights_pars_begin).toContain('float godotSpecularAmount = 1.0;');
    expect(THREE.ShaderChunk.lights_pars_begin).toContain('float godotSizeOffset = 0.0;');
    expect(THREE.ShaderChunk.normalmap_pars_fragment).toContain('vec3 godotMapNormal(');
  });

  it("leaves three's chunks alone when a patch it reads cannot install, and warns (error case)", () => {
    THREE.ShaderChunk.normalmap_pars_fragment = 'void main() {}';

    expect(warningsOf(installGodotLightFunction)).toHaveLength(1);
    expect(installedChunks()).toEqual(threeChunks);
  });

  it('finds itself installed after another patch adds a field to the material struct (edge case)', () => {
    installGodotLightFunction();
    THREE.ShaderChunk[CHUNK] = THREE.ShaderChunk[CHUNK].replace(
      'struct PhysicalMaterial {',
      'struct PhysicalMaterial {\n\tvec3 otherField;'
    );

    expect(warningsOf(installGodotLightFunction)).toEqual([]);
  });
});

describe('the light function chunk', () => {
  it('writes Burley in the branch the chunk takes with no define', () => {
    const lightFunction = godotChunks()[CHUNK].split('#elif defined( GODOT_DIFFUSE_TOON )')[1]!;
    expect(lightFunction.split('#endif')[0]).toMatch(/#else[\s\S]*fd90Minus1/);
  });
});

describe('threeAnisotropy', () => {
  it('passes a positive anisotropy through, unturned', () => {
    expect(threeAnisotropy(0.5)).toEqual({ anisotropy: 0.5, anisotropyRotation: 0 });
  });

  it('turns a negative anisotropy by π, so anisotropyVector.x carries the sign', () => {
    const { anisotropy, anisotropyRotation } = threeAnisotropy(-0.5);
    expect(anisotropy).toBe(0.5);
    expect(anisotropy * Math.cos(anisotropyRotation)).toBeLessThan(0);
  });

  it('leaves 0 unturned, which three draws isotropic (edge case)', () => {
    expect(threeAnisotropy(0)).toEqual({ anisotropy: 0, anisotropyRotation: 0 });
  });
});
