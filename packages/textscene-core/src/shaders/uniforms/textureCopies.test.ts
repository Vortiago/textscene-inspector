import { describe, expect, it } from 'vitest';
import { DataTexture, type Texture } from 'three';
import { followSource, TextureCopies } from './textureCopies.js';

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

  it('leaves a texture that is no copy as it is', () => {
    const texture = imageTexture();
    const before = texture.version;
    followSource(texture);
    expect(texture.version).toBe(before);
  });
});
