/**
 * The channel repack (Godot alpha strength to three.js blue). happy-dom has no WebGL2, so each
 * test repacks a DataTexture or asserts the unreadable case. The `material-anisotropy-flowmap` golden
 * covers the real readback.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { repackAnisotropyFlowmap } from './repackFlowmap';
import { mipChain, type MipLevel } from '../processing/mipChain';

/** A decoded-image-shaped object: dimensions but no raw `.data`. */
function imageLike(width = 2, height = 1): HTMLImageElement {
  return { width, height, naturalWidth: width, naturalHeight: height } as HTMLImageElement;
}

describe('repackAnisotropyFlowmap', () => {
  /** Two pixels: neutral direction, blue unused, distinct alpha strengths. */
  const SOURCE = new Uint8Array([128, 128, 0, 200, 10, 20, 0, 30]);

  function dataTexture(): THREE.Texture {
    const texture = new THREE.DataTexture(new Uint8Array(SOURCE), 2, 1, THREE.RGBAFormat);
    texture.needsUpdate = true;
    return texture;
  }

  it('copies ALPHA into BLUE for a DataTexture flowmap and leaves the source untouched', () => {
    const source = dataTexture();
    const out = repackAnisotropyFlowmap(source)!;

    const data = (out.image as { data: Uint8Array }).data;
    expect(Array.from(data)).toEqual([128, 128, 200, 200, 10, 20, 30, 30]);
    // The cached input is shared by every consumer of that flowmap path.
    expect(Array.from((source.image as { data: Uint8Array }).data)).toEqual(Array.from(SOURCE));
    expect(out.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('repacks each level of the chain its import built', () => {
    const source = dataTexture();
    source.mipmaps = mipChain(source.image as MipLevel, false) as unknown as THREE.Texture['mipmaps'];
    source.generateMipmaps = false;

    const out = repackAnisotropyFlowmap(source)!;

    expect(Array.from((out.mipmaps[1] as MipLevel).data)).toEqual([69, 74, 115, 115]);
  });

  it('asks the GPU for no chain over a repacked chain', () => {
    const source = dataTexture();
    source.mipmaps = mipChain(source.image as MipLevel, false) as unknown as THREE.Texture['mipmaps'];
    source.generateMipmaps = false;

    expect(repackAnisotropyFlowmap(source)!.generateMipmaps).toBe(false);
  });

  it('carries the source texture sampling settings onto the repacked texture', () => {
    const source = dataTexture();
    source.wrapS = THREE.RepeatWrapping;
    source.wrapT = THREE.MirroredRepeatWrapping;
    source.magFilter = THREE.NearestFilter;
    source.minFilter = THREE.LinearFilter;
    source.flipY = false;

    const out = repackAnisotropyFlowmap(source)!;

    expect(out.wrapS).toBe(THREE.RepeatWrapping);
    expect(out.wrapT).toBe(THREE.MirroredRepeatWrapping);
    expect(out.magFilter).toBe(THREE.NearestFilter);
    expect(out.minFilter).toBe(THREE.LinearFilter);
    expect(out.flipY).toBe(false);
  });

  it('takes mipmapping from the source rather than the DataTexture default', () => {
    // A loaded image asks for mipmaps, and a DataTexture defaults to
    // generateMipmaps=false, which samples level 0 at every distance.
    const loaded = dataTexture();
    loaded.minFilter = THREE.LinearMipmapLinearFilter;
    loaded.generateMipmaps = true;

    const out = repackAnisotropyFlowmap(loaded)!;

    expect(out.generateMipmaps).toBe(true);
    expect(out.minFilter).toBe(THREE.LinearMipmapLinearFilter);
  });

  it('keeps a source without mipmaps free of them', () => {
    expect(repackAnisotropyFlowmap(dataTexture())!.generateMipmaps).toBe(false);
  });

  it('returns undefined when no pixels can be read, so the caller wires no map', () => {
    const texture = new THREE.Texture(imageLike());
    // happy-dom has no WebGL2 context, so a decoded image is unreadable.
    expect(repackAnisotropyFlowmap(texture)).toBeUndefined();
  });
});
