/**
 * The unlit varyings ride three's unlit program text. A three release that moves a line they anchor
 * on fails here, not as an unlit surface that silently loses its decals and its prepass normal.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installUnlitVaryings, UNLIT_NORMAL_VARYING, UNLIT_VIEW_VARYING } from './unlitVaryings';
import { warningsOf } from '../testing/logWarnings';
import { restoreShaderGlobalsAfterEach } from '../testing/shaderPatches';

restoreShaderGlobalsAfterEach();

describe('installUnlitVaryings', () => {
  it('installs on three without a warning', () => {
    expect(warningsOf(installUnlitVaryings)).toEqual([]);
  });

  it('writes the view position and the normal of every unlit surface, skinned or not', () => {
    installUnlitVaryings();
    const vertex = THREE.ShaderLib.basic.vertexShader;

    expect(vertex).toContain(`${UNLIT_VIEW_VARYING} = mvPosition.xyz;`);
    expect(vertex).toContain(`${UNLIT_NORMAL_VARYING} = transformedNormal;`);
    expect(vertex).not.toContain('#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )');
  });

  it('declares both varyings in the unlit fragment program', () => {
    installUnlitVaryings();
    const fragment = THREE.ShaderLib.basic.fragmentShader;

    expect(fragment).toContain(`varying vec3 ${UNLIT_VIEW_VARYING};`);
    expect(fragment).toContain(`varying vec3 ${UNLIT_NORMAL_VARYING};`);
  });

  it('changes nothing on a second call', () => {
    installUnlitVaryings();
    const vertex = THREE.ShaderLib.basic.vertexShader;
    installUnlitVaryings();

    expect(THREE.ShaderLib.basic.vertexShader).toBe(vertex);
  });
});
