/**
 * The decal term rides three's program text. A three release that moves a line it anchors on fails
 * here, not as a surface that silently loses its decals.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installGodotDecals } from './decalShaderChunk';
import { DECAL_UNIFORMS, decalAtlasSlot, decalRowsSlot, shownDecals } from './decalSlots';
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
    'mixes the decals into the %s albedo from the geometry normal, before the normal map',
    (program) => {
      installGodotDecals();
      const fragment = THREE.ShaderLib[program].fragmentShader;

      expect(fragment.indexOf('#include <normal_fragment_begin>')).toBeLessThan(fragment.indexOf(APPLY));
      expect(fragment.indexOf(APPLY)).toBeLessThan(fragment.indexOf('#include <normal_fragment_maps>'));
    }
  );

  it('mixes the decals into the unlit albedo once the alpha tests are done', () => {
    installGodotDecals();
    const fragment = THREE.ShaderLib.basic.fragmentShader;

    expect(fragment.indexOf('#include <alphahash_fragment>')).toBeLessThan(fragment.indexOf(APPLY));
    expect(fragment.indexOf(APPLY)).toBeLessThan(
      fragment.indexOf('reflectedLight.indirectDiffuse *= diffuseColor.rgb')
    );
  });

  it('has the unlit vertex hand on the view position and the normal of every surface', () => {
    installGodotDecals();
    const vertex = THREE.ShaderLib.basic.vertexShader;

    expect(vertex).toContain('vGodotDecalView = mvPosition.xyz;');
    expect(vertex).toContain('vGodotDecalNormal = transformedNormal;');
    expect(vertex).not.toContain('#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )');
  });

  it('gives every program with fog the atlas, the rows and the shown decals', () => {
    installGodotDecals();

    for (const program of ['basic', 'standard', 'physical'] as const) {
      const { uniforms } = THREE.ShaderLib[program];
      expect(uniforms[DECAL_UNIFORMS.atlas]!.value).toBe(decalAtlasSlot);
      expect(uniforms[DECAL_UNIFORMS.rows]!.value).toBe(decalRowsSlot);
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
