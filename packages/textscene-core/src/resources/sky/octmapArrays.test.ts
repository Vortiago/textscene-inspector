import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { reflectionAtlasLayout } from '../../godot/rendering/environment/reflectionProbe';
import { createReflectionAtlas, createSkyLayers, disposeSkyLayers } from './octmapArrays';

describe('disposeSkyLayers', () => {
  it('frees the array', () => {
    const layers = createSkyLayers({ radianceFilter: 'importance-sample', radianceSize: 32 });
    const disposed = vi.spyOn(layers.target, 'dispose');

    disposeSkyLayers(layers);

    expect(disposed).toHaveBeenCalledOnce();
  });
});

describe('createReflectionAtlas', () => {
  it('holds an octmap layer per probe, as wide as the layout', () => {
    const atlas = createReflectionAtlas(reflectionAtlasLayout(false), 3);

    expect([atlas.target.width, atlas.target.height, atlas.target.depth]).toEqual([768, 768, 3]);
  });

  it("holds only Godot's layers as mips, as three caps the texture's last level there", () => {
    const layout = reflectionAtlasLayout(false);

    const { mipmaps } = createReflectionAtlas(layout, 1).target.texture;

    expect(mipmaps).toHaveLength(1 + layout.downsampledSizes.length);
  });

  it('magnifies linearly, as a read below mip 0 does in Godot', () => {
    expect(createReflectionAtlas(reflectionAtlasLayout(false), 1).target.texture.magFilter).toBe(
      THREE.LinearFilter
    );
  });

  it('holds one layer for an atlas of no probes, as a texture array needs a layer (edge case)', () => {
    expect(createReflectionAtlas(reflectionAtlasLayout(true), 0).target.depth).toBe(1);
  });
});
