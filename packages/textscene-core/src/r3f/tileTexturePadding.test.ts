/**
 * The program injection that clamps a tile's texture sample to its own texels, the effect of
 * Godot's padded atlas (`tile_set.cpp:5622-5671`).
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { TILE_TEXTURE_PADDING, TILE_UV_BOUNDS_ATTRIBUTE } from './tileTexturePadding';
import { installCanvasSrgbMultiply } from './canvasSrgbMultiply';

function compiledBasic() {
  const shader = {
    vertexShader: THREE.ShaderLib.basic.vertexShader,
    fragmentShader: THREE.ShaderLib.basic.fragmentShader,
    uniforms: {},
  };
  TILE_TEXTURE_PADDING.onBeforeCompile.call(new THREE.MeshBasicMaterial(), shader);
  return shader;
}

describe('TILE_TEXTURE_PADDING', () => {
  it('samples the map at the UV clamped to the tile bounds', () => {
    const { fragmentShader } = compiledBasic();
    expect(fragmentShader).toContain('texture2D( map, clamp( vMapUv, vTileUvBounds.xy, vTileUvBounds.zw ) )');
    expect(fragmentShader).not.toContain('#include <map_fragment>');
  });

  it('passes the per-vertex bounds attribute through to the fragment', () => {
    const { vertexShader, fragmentShader } = compiledBasic();
    expect(vertexShader).toContain(`attribute vec4 ${TILE_UV_BOUNDS_ATTRIBUTE};`);
    expect(vertexShader).toContain(`vTileUvBounds = ${TILE_UV_BOUNDS_ATTRIBUTE};`);
    expect(fragmentShader).toContain('varying vec4 vTileUvBounds;');
  });

  it('keeps the sRGB multiply the 2D canvas patches into the map chunk (edge)', () => {
    installCanvasSrgbMultiply();
    const { fragmentShader } = compiledBasic();
    expect(fragmentShader).toContain('#ifdef CANVAS_SRGB_MULTIPLY');
  });

  it('names its program apart from an unclamped one', () => {
    expect(TILE_TEXTURE_PADDING.cacheKey).not.toBe('');
  });
});
