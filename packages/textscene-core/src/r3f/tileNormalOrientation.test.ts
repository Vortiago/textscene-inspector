/**
 * The program injection that hands a tile's flips and transpose to the fragment, where a
 * normal-mapped program turns the normal by them (`canvas.glsl:655-661`).
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { TILE_NORMAL_ORIENTATION, TILE_NORMAL_ORIENTATION_ATTRIBUTE } from './tileNormalOrientation';

function compiledBasic() {
  const shader = {
    vertexShader: THREE.ShaderLib.basic.vertexShader,
    fragmentShader: THREE.ShaderLib.basic.fragmentShader,
    uniforms: {},
  };
  TILE_NORMAL_ORIENTATION.onBeforeCompile.call(new THREE.MeshBasicMaterial(), shader);
  return shader;
}

describe('TILE_NORMAL_ORIENTATION', () => {
  it('passes the per-vertex orientation attribute through to the fragment', () => {
    const { vertexShader, fragmentShader } = compiledBasic();
    expect(vertexShader).toContain(`attribute vec3 ${TILE_NORMAL_ORIENTATION_ATTRIBUTE};`);
    expect(vertexShader).toContain(`vTileNormalOrientation = ${TILE_NORMAL_ORIENTATION_ATTRIBUTE};`);
    expect(fragmentShader).toContain('varying vec3 vTileNormalOrientation;');
  });

  it('tells a normal-mapped program that the mesh carries an orientation', () => {
    expect(compiledBasic().fragmentShader).toContain('#define TILE_NORMAL_ORIENTATION');
  });

  it('names its program apart from one without it', () => {
    expect(TILE_NORMAL_ORIENTATION.cacheKey).not.toBe('');
  });
});
