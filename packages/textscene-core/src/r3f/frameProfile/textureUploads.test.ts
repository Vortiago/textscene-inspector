import { describe, expect, it, vi } from 'vitest';
import { countTextureUploads } from './textureUploads';

function fakeContext() {
  const texSubImage2D = vi.fn(() => 'uploaded');
  return { gl: { texSubImage2D, drawArrays: vi.fn() } as unknown as WebGL2RenderingContext, texSubImage2D };
}

describe('countTextureUploads', () => {
  it('counts each upload and still makes it', () => {
    const { gl, texSubImage2D } = fakeContext();
    const onUpload = vi.fn();
    countTextureUploads(gl, onUpload);

    const result = gl.texSubImage2D(0, 0, 0, 0, 0, 0, 0, 0, null);

    expect([onUpload.mock.calls.length, texSubImage2D.mock.calls.length, result]).toEqual([1, 1, 'uploaded']);
  });

  it('counts no draw call', () => {
    const { gl } = fakeContext();
    const onUpload = vi.fn();
    countTextureUploads(gl, onUpload);

    gl.drawArrays(0, 0, 3);

    expect(onUpload).not.toHaveBeenCalled();
  });

  it("puts the context's own call back at stop", () => {
    const { gl, texSubImage2D } = fakeContext();
    countTextureUploads(gl, vi.fn())();

    expect(gl.texSubImage2D).toBe(texSubImage2D);
  });
});
