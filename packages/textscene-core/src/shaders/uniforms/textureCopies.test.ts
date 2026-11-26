import { describe, expect, it } from 'vitest';
import { DataTexture, WebGLRenderTarget, type Texture } from 'three';
import { followSource, installTargetCopies, SharedCopies, TextureCopies } from './textureCopies.js';

const imageTexture = () => new DataTexture(new Uint8Array(16), 2, 2);

const nearest = (copy: Texture) => {
  copy.flipY = false;
};

const disposals = (texture: Texture) => {
  const count = { value: 0 };
  texture.addEventListener('dispose', () => count.value++);
  return count;
};

describe('TextureCopies', () => {
  // three keeps one upload version per `Source` (`WebGLTextures.js:976`), so a shared one skips an upload.
  it('gives a copy a source of its own over the same image', () => {
    const source = imageTexture();
    const copy = new TextureCopies(nearest).copyOf(source);
    expect([copy.source === source.source, copy.image === source.image]).toEqual([false, true]);
  });

  it('copies a shared texture, whose clone is itself, into a texture of its own', () => {
    const shared = imageTexture();
    shared.clone = () => shared as never;
    shared.flipY = true;
    const source = shared.source;
    const copy = new TextureCopies(nearest).copyOf(shared);
    expect([copy === shared, shared.source === source, shared.flipY]).toEqual([false, true, true]);
  });

  it('keeps one copy while the material texture stays the same', () => {
    const copies = new TextureCopies(nearest);
    const source = imageTexture();
    expect(copies.copyOf(source)).toBe(copies.copyOf(source));
  });

  it('gives the copy the sampler state of the binding', () => {
    expect(new TextureCopies(nearest).copyOf(imageTexture()).flipY).toBe(false);
  });

  it('frees each copy that no node binds any more', () => {
    const copies = new TextureCopies(nearest);
    const [replaced, kept] = [copies.copyOf(imageTexture()), copies.copyOf(imageTexture())];
    const [replacedDisposals, keptDisposals] = [disposals(replaced), disposals(kept)];
    copies.release([kept]);
    expect([replacedDisposals.value, keptDisposals.value]).toEqual([1, 0]);
  });

  it('makes a new copy of a texture after its copy is freed', () => {
    const copies = new TextureCopies(nearest);
    const source = imageTexture();
    const first = copies.copyOf(source);
    copies.release([]);
    expect(copies.copyOf(source)).not.toBe(first);
  });

  it('frees the copy when the material texture is disposed', () => {
    const source = imageTexture();
    const copyDisposals = disposals(new TextureCopies(nearest).copyOf(source));
    source.dispose();
    expect(copyDisposals.value).toBe(1);
  });

  it('binds the host copy of a render target and releases it once no node binds it', () => {
    const host = imageTexture();
    let releases = 0;
    installTargetCopies((_source, configure) => {
      configure(host);
      return { copy: host, release: () => releases++ };
    });
    const copies = new TextureCopies(nearest);
    const copy = copies.copyOf(new WebGLRenderTarget(2, 2).texture);
    copies.release([]);
    installTargetCopies(() => null);
    expect([copy === host, copy.flipY, releases]).toEqual([true, false, 1]);
  });
});

describe('SharedCopies', () => {
  it('hands every holder of a texture one copy', () => {
    const shared = new SharedCopies(nearest);
    const source = imageTexture();
    expect(shared.hold(source)).toBe(shared.hold(source));
  });

  it('keeps the copy while a holder is left', () => {
    const shared = new SharedCopies(nearest);
    const source = imageTexture();
    const copy = shared.hold(source);
    shared.hold(source);
    const count = disposals(copy);
    shared.release(source);
    expect(count.value).toBe(0);
  });

  it('frees the copy with its last holder, and leaves the copies of other textures', () => {
    const shared = new SharedCopies(nearest);
    const [released, kept] = [imageTexture(), imageTexture()];
    const counts = [disposals(shared.hold(released)), disposals(shared.hold(kept))];
    shared.release(released);
    expect(counts.map((count) => count.value)).toEqual([1, 0]);
  });

  it('keeps the copy when the texture drops its storage to resize, as an atlas does', () => {
    const shared = new SharedCopies(nearest);
    const source = imageTexture();
    const copy = shared.hold(source);
    source.dispose();
    expect(shared.hold(source)).toBe(copy);
  });

  it('refuses a release of a texture it does not hold', () => {
    expect(() => new SharedCopies(nearest).release(imageTexture())).toThrow(
      'expected a held texture to release, got one no holder holds'
    );
  });
});

describe('followSource', () => {
  it('updates the copy once after each update of the material texture', () => {
    const source = imageTexture();
    const copy = new TextureCopies(nearest).copyOf(source);
    const before = copy.version;
    source.needsUpdate = true;
    followSource(copy);
    followSource(copy);
    expect(copy.version).toBe(before + 1);
  });

  it('reads the image and the levels the material texture holds after the update', () => {
    const source = imageTexture();
    const copy = new TextureCopies(nearest).copyOf(source);
    source.image = { data: new Uint8Array(4), width: 1, height: 1 };
    source.mipmaps = [{ data: new Uint8Array(4), width: 1, height: 1 }];
    source.needsUpdate = true;
    followSource(copy);
    expect([copy.image, copy.mipmaps]).toEqual([source.image, source.mipmaps]);
  });

  it("drops the copy's storage when the material texture changes size: three allocates it once", () => {
    const source = imageTexture();
    const copy = new TextureCopies(nearest).copyOf(source);
    const count = disposals(copy);
    source.image = { data: new Uint8Array(64), width: 4, height: 4 };
    source.needsUpdate = true;
    followSource(copy);
    expect(count.value).toBe(1);
  });

  it("keeps the copy's storage for new pixels of the same size", () => {
    const source = imageTexture();
    const copy = new TextureCopies(nearest).copyOf(source);
    const count = disposals(copy);
    source.image = { data: new Uint8Array(16), width: 2, height: 2 };
    source.needsUpdate = true;
    followSource(copy);
    expect(count.value).toBe(0);
  });

  it('leaves a texture that is no copy as it is', () => {
    const texture = imageTexture();
    const before = texture.version;
    followSource(texture);
    expect(texture.version).toBe(before);
  });
});
