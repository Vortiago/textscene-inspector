import { describe, expect, it } from 'vitest';
import { readImagePixels, readPixelsThroughGl } from './imagePixels';

/** A WebGL2 stand-in that records each call and reads back `texels`. */
function fakeGl(texels: number[], { complete = true, error = 0 } = {}) {
  const calls: string[] = [];
  const unpack = new Map<number, unknown>();
  const gl = {
    TEXTURE_2D: 1,
    FRAMEBUFFER: 2,
    COLOR_ATTACHMENT0: 3,
    RGBA: 4,
    RGBA8: 5,
    UNSIGNED_BYTE: 6,
    NONE: 7,
    FRAMEBUFFER_COMPLETE: 8,
    NO_ERROR: 0,
    UNPACK_FLIP_Y_WEBGL: 10,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 11,
    UNPACK_COLORSPACE_CONVERSION_WEBGL: 12,
    createTexture: () => 'texture',
    createFramebuffer: () => 'framebuffer',
    bindTexture: () => calls.push('bindTexture'),
    bindFramebuffer: () => calls.push('bindFramebuffer'),
    pixelStorei: (name: number, value: unknown) => unpack.set(name, value),
    texImage2D: () => calls.push(`texImage2D premultiply=${String(unpack.get(11))}`),
    framebufferTexture2D: () => calls.push('framebufferTexture2D'),
    checkFramebufferStatus: () => (complete ? 8 : 9),
    getError: () => error,
    readPixels: (_x: number, _y: number, _w: number, _h: number, _f: number, _t: number, out: Uint8Array) =>
      out.set(texels),
    deleteTexture: () => calls.push('deleteTexture'),
    deleteFramebuffer: () => calls.push('deleteFramebuffer'),
  };
  return { gl: gl as unknown as WebGL2RenderingContext, calls, unpack };
}

const image = { width: 2, height: 1 };

describe('readPixelsThroughGl', () => {
  it('returns the uploaded bytes unpremultiplied, with the RGB behind alpha 0 intact', () => {
    const texels = [255, 255, 255, 0, 10, 20, 30, 128];
    const { gl } = fakeGl(texels);

    const pixels = readPixelsThroughGl(gl, image);

    expect(pixels).toEqual({ data: new Uint8Array(texels), width: 2, height: 1 });
  });

  it('uploads with no premultiply, no flip and no colour conversion', () => {
    const { gl, calls, unpack } = fakeGl([0, 0, 0, 0, 0, 0, 0, 0]);

    readPixelsThroughGl(gl, image);

    expect(calls).toContain('texImage2D premultiply=false');
    expect(unpack.get(gl.UNPACK_FLIP_Y_WEBGL)).toBe(false);
    expect(unpack.get(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL)).toBe(gl.NONE);
  });

  it('returns undefined when the framebuffer cannot hold the image', () => {
    const { gl } = fakeGl([0, 0, 0, 0, 0, 0, 0, 0], { complete: false });

    expect(readPixelsThroughGl(gl, image)).toBeUndefined();
  });

  it('returns undefined when the upload or read raises a GL error', () => {
    const { gl } = fakeGl([0, 0, 0, 0, 0, 0, 0, 0], { error: 1281 });

    expect(readPixelsThroughGl(gl, image)).toBeUndefined();
  });

  it('deletes its texture and framebuffer after the read', () => {
    const { gl, calls } = fakeGl([0, 0, 0, 0, 0, 0, 0, 0]);

    readPixelsThroughGl(gl, image);

    expect(calls).toEqual(expect.arrayContaining(['deleteTexture', 'deleteFramebuffer']));
  });

  it('returns undefined for an image with no size', () => {
    const { gl } = fakeGl([]);

    expect(readPixelsThroughGl(gl, { width: 0, height: 0 })).toBeUndefined();
  });
});

describe('readImagePixels', () => {
  it("returns a DataTexture image's own bytes", () => {
    const data = new Uint8Array([1, 2, 3, 4]);

    expect(readImagePixels({ data, width: 1, height: 1 })).toEqual({ data, width: 1, height: 1 });
  });

  it('returns undefined for a decoded image where no WebGL2 context exists (happy-dom)', () => {
    expect(readImagePixels({ width: 2, height: 2 })).toBeUndefined();
  });

  it('returns undefined for nothing decoded', () => {
    expect(readImagePixels(null)).toBeUndefined();
  });
});
