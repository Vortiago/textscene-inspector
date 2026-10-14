/**
 * The channel repack (Godot alpha strength to three.js blue). happy-dom has no WebGL2, so each
 * test injects a reader or asserts the unreadable case. The `material-anisotropy-flowmap` golden
 * covers the real readback.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { ImagePixels } from '../formats/image/imagePixels';
import { repackAnisotropyFlowmap } from './repackFlowmap';

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

  it('repacks image-backed pixels the reader supplies (the real-asset path)', () => {
    // Stands in for a decoded PNG read back by the browser: no `.data` on the texture image itself.
    const texture = new THREE.Texture(imageLike());
    const read = vi.fn((): ImagePixels => ({ data: new Uint8ClampedArray(SOURCE), width: 2, height: 1 }));

    const out = repackAnisotropyFlowmap(texture, read)!;

    expect(read).toHaveBeenCalledWith(texture.image);
    // `repackAnisotropyFlowmap` returns `THREE.Texture | undefined`, but always a
    // `DataTexture`, whose `.image` carries `data`, `width` and `height`.
    const image = out.image as { data: Uint8Array; width: number; height: number };
    expect(image.data).toBeInstanceOf(Uint8Array);
    expect(Array.from(image.data)).toEqual([128, 128, 200, 200, 10, 20, 30, 30]);
    expect(image.width).toBe(2);
    expect(image.height).toBe(1);
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
    const loaded = new THREE.Texture(imageLike());
    loaded.minFilter = THREE.LinearMipmapLinearFilter;
    expect(loaded.generateMipmaps).toBe(true);

    const out = repackAnisotropyFlowmap(loaded, () => ({
      data: new Uint8ClampedArray(SOURCE),
      width: 2,
      height: 1,
    }))!;

    expect(out.generateMipmaps).toBe(true);
    expect(out.minFilter).toBe(THREE.LinearMipmapLinearFilter);

    // …and a source that does not want them still gets none.
    const plain = dataTexture();
    expect(plain.generateMipmaps).toBe(false);
    expect(repackAnisotropyFlowmap(plain)!.generateMipmaps).toBe(false);
  });

  it('returns undefined when no pixels can be read, so the caller wires no map', () => {
    const texture = new THREE.Texture(imageLike());
    // Default reader under happy-dom: no WebGL2 context, nothing readable.
    expect(repackAnisotropyFlowmap(texture)).toBeUndefined();
    expect(repackAnisotropyFlowmap(texture, () => undefined)).toBeUndefined();
  });
});
