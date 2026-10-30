/**
 * The decal term rides three's program text. A three release that moves a line it anchors on fails
 * here, not as a surface that silently loses its decals.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installGodotDecals } from './decalShaderChunk';
import { DECAL_UNIFORMS, decalAtlasSlot, shownDecals } from './decalSlots';
import { warningsOf } from '../testing/logWarnings';
import { restoreShaderGlobalsAfterEach } from '../testing/shaderPatches';

restoreShaderGlobalsAfterEach();

const LIT_PROGRAMS = ['standard', 'physical'] as const;
const APPLY = 'godotApplyDecals(';

describe('installGodotDecals', () => {
  it('installs on three without a warning', () => {
    expect(warningsOf(installGodotDecals)).toEqual([]);
    expect(THREE.ShaderLib.standard.fragmentShader).toContain(APPLY);
  });

  it.each(LIT_PROGRAMS)(
    'mixes the decals into the %s surface after its normal and emissive maps, from the geometry normal',
    (program) => {
      installGodotDecals();
      const fragment = THREE.ShaderLib[program].fragmentShader;

      expect(fragment.indexOf('#include <normal_fragment_maps>')).toBeLessThan(fragment.indexOf(APPLY));
      expect(fragment.indexOf('#include <emissivemap_fragment>')).toBeLessThan(fragment.indexOf(APPLY));
      expect(fragment.indexOf(APPLY)).toBeLessThan(fragment.indexOf('#include <lights_physical_fragment>'));
      expect(fragment).toContain(
        'godotApplyDecals( godotDecalSurface, - vViewPosition, nonPerturbedNormal );'
      );
    }
  );

  it.each(LIT_PROGRAMS)('mixes the normal, ORM and emission maps in the %s program only', (program) => {
    installGodotDecals();
    const fragment = THREE.ShaderLib[program].fragmentShader;

    expect(fragment.indexOf('#define GODOT_DECAL_SHADED')).toBeLessThan(
      fragment.indexOf('#include <godot_decal_pars>')
    );
    expect(THREE.ShaderLib.basic.fragmentShader).not.toContain('GODOT_DECAL_SHADED');
  });

  it.each(LIT_PROGRAMS)('scales the emission of the decals by the exposure in the %s program', (program) => {
    installGodotDecals();

    expect(THREE.ShaderLib[program].fragmentShader).toContain(
      'totalEmissiveRadiance += godotDecalSurface.emission * godotEmissionExposure[ 0 ];'
    );
  });

  it.each(LIT_PROGRAMS)('hands the occlusion of the decals to the AO chunk of the %s program', (program) => {
    installGodotDecals();
    const fragment = THREE.ShaderLib[program].fragmentShader;

    expect(fragment).toContain('godotOcclusionMix = godotDecalSurface.occlusion;');
    expect(THREE.ShaderChunk.aomap_fragment).toContain(
      'ambientOcclusion * godotOcclusionMix.x + godotOcclusionMix.y'
    );
  });

  it('filters a normal or ORM read that magnifies from the bytes of its taps, when the atlas magnifies linearly', () => {
    installGodotDecals();
    const chunk = (THREE.ShaderChunk as Record<string, string>)['godot_decal_pars']!;

    expect(chunk).toContain(`${DECAL_UNIFORMS.shown}[ 0 ].z == 0.0`);
    expect(chunk).toContain(`texelFetch( ${DECAL_UNIFORMS.atlas}`);
  });

  it('mixes the decals into the unlit albedo once the alpha tests are done', () => {
    installGodotDecals();
    const fragment = THREE.ShaderLib.basic.fragmentShader;

    expect(fragment.indexOf('#include <alphahash_fragment>')).toBeLessThan(fragment.indexOf(APPLY));
    expect(fragment.indexOf(APPLY)).toBeLessThan(
      fragment.indexOf('reflectedLight.indirectDiffuse *= diffuseColor.rgb')
    );
    expect(fragment).toContain('GodotDecalSurface( diffuseColor.rgb )');
  });

  it('has the unlit vertex hand on the view position and the normal of every surface', () => {
    installGodotDecals();
    const vertex = THREE.ShaderLib.basic.vertexShader;

    expect(vertex).toContain('vGodotDecalView = mvPosition.xyz;');
    expect(vertex).toContain('vGodotDecalNormal = transformedNormal;');
    expect(vertex).not.toContain('#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )');
  });

  it('gives every program with fog the atlas and the shown decals', () => {
    installGodotDecals();

    for (const program of ['basic', 'standard', 'physical'] as const) {
      const { uniforms } = THREE.ShaderLib[program];
      expect(uniforms[DECAL_UNIFORMS.atlas]!.value).toBe(decalAtlasSlot);
      expect(uniforms[DECAL_UNIFORMS.shown]!.value).toBe(shownDecals);
    }
  });

  it('changes nothing on a second call', () => {
    installGodotDecals();
    const fragment = THREE.ShaderLib.standard.fragmentShader;
    const vertex = THREE.ShaderLib.basic.vertexShader;

    installGodotDecals();

    expect([THREE.ShaderLib.standard.fragmentShader, THREE.ShaderLib.basic.vertexShader]).toEqual([
      fragment,
      vertex,
    ]);
  });
});
