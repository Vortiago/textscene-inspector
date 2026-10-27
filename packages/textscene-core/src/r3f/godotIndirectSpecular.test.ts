/**
 * Godot's specular weights ride three's own lines. A three release that rewrites one fails here,
 * not silently in a capture.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SPECULAR_OCCLUSION_DISABLED, installGodotIndirectSpecular } from './godotIndirectSpecular';
import { warningsOf } from './testing/logWarnings';
import { restoreShaderGlobalsAfterEach } from './testing/shaderPatches';
import { DFG_SIZE } from '../godot/rendering/materials/dfgTable.generated';

const threeChunks = { ...THREE.ShaderChunk };

restoreShaderGlobalsAfterEach();

function patchedChunks() {
  installGodotIndirectSpecular();
  return {
    pars: THREE.ShaderChunk.lights_physical_pars_fragment,
    begin: THREE.ShaderChunk.lights_fragment_begin,
    ao: THREE.ShaderChunk.aomap_fragment,
  };
}

describe('installGodotIndirectSpecular', () => {
  it("reads Godot's table at Godot's clamped N.V and roughness", () => {
    expect(patchedChunks().begin).toContain(
      'texture2D( godotDfgTable, vec2( clamp( dot( geometryNormal, geometryViewDir ), 0.0001, 1.0 ), material.godotRoughness ) ).rg'
    );
  });

  it("weighs the reflection with Godot's split sum and energy compensation", () => {
    const { pars } = patchedChunks();

    expect(pars).toContain('( godotF90 - godotF0 ) * material.godotDfg.x + godotF0 * material.godotDfg.y');
    expect(pars).toContain('1.0 + godotF0 * ( 1.0 / material.godotDfg.y - 1.0 )');
    expect(pars).not.toContain('indirectSpecular += multiScattering * cosineWeightedIrradiance;');
  });

  it("weighs a toon surface's reflection by its specular, metallic and albedo instead", () => {
    const { pars } = patchedChunks();

    expect(pars).toContain('#ifdef GODOT_DIFFUSE_TOON');
    expect(pars).toContain(
      'radiance * sqrt( material.specularColor.g / 0.16 ) * material.metalness * material.diffuseColor * 2.0'
    );
  });

  it("compensates the direct specular from Godot's table", () => {
    expect(patchedChunks().begin).toContain('( 1.0 / material.godotDfg.y - 1.0 )');
  });

  it('occludes a reflection by the luminance of the ambient after the AO map, as Godot does', () => {
    const { ao } = patchedChunks();

    expect(ao).toContain('( irradiance + iblIrradiance ) * RECIPROCAL_PI * godotAmbientOcclusion');
    expect(ao).toContain('min( dot( godotAmbientLight, vec3( 0.3, 0.59, 0.11 ) ) * 8.0, 1.0 )');
    expect(ao.indexOf('reflectedLight.indirectSpecular *= godotSpecularOcclusion;')).toBeGreaterThan(
      ao.indexOf('ambientOcclusion = (')
    );
  });

  it('occludes a reflection without a sky too, as a ReflectionProbe reflects without one (edge case)', () => {
    expect(patchedChunks().ao).toContain(
      '#if defined( STANDARD ) && ! defined( GODOT_SPECULAR_OCCLUSION_DISABLED )'
    );
  });

  it('keeps more of a smooth metal reflection under a dim ambient', () => {
    expect(patchedChunks().ao).toContain(
      'max( min( godotReflective * godotSpecularOcclusion * 10.0, 1.0 ), godotSpecularOcclusion )'
    );
  });

  it("drops three's occlusion of a reflection by the AO map alone", () => {
    const { ao } = patchedChunks();

    expect(ao).not.toContain('computeSpecularOcclusion');
    expect(ao).not.toContain('clearcoatSpecularIndirect *= ambientOcclusion;');
  });

  it('skips the occlusion in a material that disables it', () => {
    const shader = { vertexShader: '', fragmentShader: 'void main() {}', uniforms: {} };
    SPECULAR_OCCLUSION_DISABLED.onBeforeCompile.call(new THREE.MeshStandardMaterial(), shader);

    expect(shader.fragmentShader.startsWith('#define GODOT_SPECULAR_OCCLUSION_DISABLED\n')).toBe(true);
    expect(patchedChunks().ao).toContain('! defined( GODOT_SPECULAR_OCCLUSION_DISABLED )');
  });

  it("gives every lit material Godot's table", () => {
    installGodotIndirectSpecular();
    const table = THREE.ShaderLib.standard.uniforms.godotDfgTable?.value as THREE.DataTexture;

    expect(table.image.width).toBe(DFG_SIZE);
    expect(table.type).toBe(THREE.HalfFloatType);
  });

  it('gives every lit material the one table, not a clone', () => {
    installGodotIndirectSpecular();
    const table = THREE.ShaderLib.standard.uniforms.godotDfgTable?.value;

    expect(THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms).godotDfgTable?.value).toBe(table);
  });

  it('leaves every chunk alone when the AO chunk lacks its line, and warns (error case)', () => {
    THREE.ShaderChunk.aomap_fragment = '#ifdef USE_AOMAP\n#endif';

    expect(warningsOf(installGodotIndirectSpecular)).toHaveLength(1);
    expect(THREE.ShaderChunk.lights_fragment_begin).toBe(threeChunks.lights_fragment_begin);
  });

  it('leaves every chunk alone when one lacks its line, and warns (error case)', () => {
    THREE.ShaderChunk.lights_fragment_begin = 'void main() {}';

    expect(warningsOf(installGodotIndirectSpecular)).toHaveLength(1);
    expect(THREE.ShaderChunk.lights_physical_pars_fragment).toBe(threeChunks.lights_physical_pars_fragment);
  });

  it('changes nothing and warns nothing on a second call (edge case)', () => {
    const once = patchedChunks();

    expect(warningsOf(installGodotIndirectSpecular)).toEqual([]);
    expect(patchedChunks()).toEqual(once);
  });
});
