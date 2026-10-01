/**
 * The WebGL half of the tiled upload: it writes a band's rows from the texture's own
 * bytes into the storage three allocated, and never reads GPU state back, since each
 * read waits for every command already queued.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { webglUploadRenderer } from './webglUploadRenderer';

const GL = {
  TEXTURE_2D: 0x0de1,
  TEXTURE0: 0x84c0,
  RGBA: 0x1908,
  UNSIGNED_BYTE: 0x1401,
  UNPACK_FLIP_Y_WEBGL: 0x9240,
  UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241,
  UNPACK_ALIGNMENT: 0x0cf5,
  UNPACK_ROW_LENGTH: 0x0cf2,
  UNPACK_IMAGE_HEIGHT: 0x806e,
  UNPACK_SKIP_PIXELS: 0x0cf4,
  UNPACK_SKIP_ROWS: 0x0cf3,
  UNPACK_SKIP_IMAGES: 0x806d,
};

function fakeThreeRenderer() {
  const handle = { name: 'storage' };
  const gl = {
    ...GL,
    texSubImage2D: vi.fn(),
    generateMipmap: vi.fn(),
    getParameter: vi.fn(),
  };
  const state = { bindTexture: vi.fn(), pixelStorei: vi.fn() };
  const renderer = {
    getContext: () => gl,
    state,
    properties: { get: () => ({ __webglTexture: handle }) },
    initTexture: vi.fn(),
  };
  return { renderer: renderer as unknown as THREE.WebGLRenderer, gl, state, handle };
}

function dataTexture(width: number, height: number): THREE.DataTexture {
  const data = new Uint8Array(width * height * 4).map((_, index) => index % 251);
  return new THREE.DataTexture(data, width, height);
}

describe('webglUploadRenderer', () => {
  it("writes only the band's own rows, at their place in the level", () => {
    const { renderer, gl } = fakeThreeRenderer();
    const texture = dataTexture(8, 6);
    webglUploadRenderer(renderer).writeRows(texture, 2, 5);

    const [target, level, x, y, width, rows, format, type, pixels] = gl.texSubImage2D.mock.calls[0]!;
    expect([target, level, x, y, width, rows, format, type]).toEqual([
      GL.TEXTURE_2D,
      0,
      0,
      2,
      8,
      3,
      GL.RGBA,
      GL.UNSIGNED_BYTE,
    ]);
    const data = texture.image.data as Uint8Array;
    expect(pixels).toEqual(data.subarray(2 * 8 * 4, 5 * 8 * 4));
    expect((pixels as Uint8Array).buffer).toBe(data.buffer);
  });

  it("writes a flipped texture's band at its mirrored rows, where the whole-image flip puts them", () => {
    const { renderer, gl } = fakeThreeRenderer();
    const texture = dataTexture(8, 6);
    texture.flipY = true;
    webglUploadRenderer(renderer).writeRows(texture, 1, 3);

    const [, , , y, , rows, , , pixels] = gl.texSubImage2D.mock.calls[0]!;
    expect([y, rows]).toEqual([3, 2]);
    const data = texture.image.data as Uint8Array;
    expect(pixels).toEqual(data.subarray(1 * 8 * 4, 3 * 8 * 4));
  });

  it('writes into the storage three allocated for the texture, on unit 0', () => {
    const { renderer, state, handle } = fakeThreeRenderer();
    webglUploadRenderer(renderer).writeRows(dataTexture(8, 6), 0, 1);

    expect(state.bindTexture).toHaveBeenCalledWith(GL.TEXTURE_2D, handle, GL.TEXTURE0);
  });

  it("unpacks as three does for the texture, with no row window, through three's own state cache", () => {
    const { renderer, state } = fakeThreeRenderer();
    const texture = dataTexture(8, 6);
    texture.flipY = true;
    texture.premultiplyAlpha = true;
    texture.unpackAlignment = 1;
    webglUploadRenderer(renderer).writeRows(texture, 0, 1);

    expect(new Map(state.pixelStorei.mock.calls as unknown as [number, unknown][])).toEqual(
      new Map<number, unknown>([
        [GL.UNPACK_FLIP_Y_WEBGL, true],
        [GL.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true],
        [GL.UNPACK_ALIGNMENT, 1],
        [GL.UNPACK_ROW_LENGTH, 0],
        [GL.UNPACK_IMAGE_HEIGHT, 0],
        [GL.UNPACK_SKIP_PIXELS, 0],
        [GL.UNPACK_SKIP_ROWS, 0],
        [GL.UNPACK_SKIP_IMAGES, 0],
      ])
    );
  });

  it('never reads GPU state back', () => {
    const { renderer, gl } = fakeThreeRenderer();
    const upload = webglUploadRenderer(renderer);
    const texture = dataTexture(8, 6);
    upload.writeRows(texture, 0, 6);
    upload.generateMipmaps(texture);

    expect(gl.getParameter).not.toHaveBeenCalled();
  });

  it("generates the mip chain from the filled level of the texture's own storage", () => {
    const { renderer, gl, state, handle } = fakeThreeRenderer();
    webglUploadRenderer(renderer).generateMipmaps(dataTexture(8, 6));

    expect(state.bindTexture).toHaveBeenCalledWith(GL.TEXTURE_2D, handle, GL.TEXTURE0);
    expect(gl.generateMipmap).toHaveBeenCalledWith(GL.TEXTURE_2D);
  });

  it('allocates through three', () => {
    const { renderer } = fakeThreeRenderer();
    const texture = dataTexture(8, 6);
    webglUploadRenderer(renderer).initTexture(texture);

    expect(renderer.initTexture).toHaveBeenCalledWith(texture);
  });
});
