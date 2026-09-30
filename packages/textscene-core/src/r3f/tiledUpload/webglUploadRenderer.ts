/**
 * The WebGL half of the tiled upload. A band goes up as one `texSubImage2D` over its
 * own rows of the texture's bytes, into the storage three allocated. three's
 * `copyTextureToTexture` would read the unpack state back first, and each read waits
 * for every command already queued: 132–174 ms under SwiftShader behind a new 4096²
 * level and the frames drawn meanwhile. It also hands over the whole array for every band.
 */

import type * as THREE from 'three';
import { RGBA_BYTES, type UploadRenderer } from './TiledUploadQueue';

export function webglUploadRenderer(renderer: THREE.WebGLRenderer): UploadRenderer {
  // three has required WebGL2 since r163.
  const gl = renderer.getContext() as WebGL2RenderingContext;

  /** Binds `texture`'s storage on unit 0 through three's state, so three's own binding cache stays true. */
  const bind = (texture: THREE.Texture): void => {
    const { __webglTexture: storage } = renderer.properties.get(texture) as { __webglTexture: WebGLTexture };
    renderer.state.bindTexture(gl.TEXTURE_2D, storage, gl.TEXTURE0);
  };

  return {
    initTexture: (texture) => renderer.initTexture(texture),
    writeRows: (texture, fromRow, toRow) => {
      const { data, width } = texture.image as { data: Uint8Array; width: number };
      bind(texture);
      // Through three's cache: its writes skip an unchanged value and its reads stay local.
      const { state } = renderer;
      state.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, texture.flipY);
      state.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.premultiplyAlpha);
      state.pixelStorei(gl.UNPACK_ALIGNMENT, texture.unpackAlignment);
      // The rows are their own view, so no window into a larger image applies.
      for (const windowParameter of [
        gl.UNPACK_ROW_LENGTH,
        gl.UNPACK_IMAGE_HEIGHT,
        gl.UNPACK_SKIP_PIXELS,
        gl.UNPACK_SKIP_ROWS,
        gl.UNPACK_SKIP_IMAGES,
      ]) {
        state.pixelStorei(windowParameter, 0);
      }
      const rowBytes = width * RGBA_BYTES;
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        levelRow(texture, fromRow, toRow),
        width,
        toRow - fromRow,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        data.subarray(fromRow * rowBytes, toRow * rowBytes)
      );
    },
    generateMipmaps: (texture) => {
      bind(texture);
      gl.generateMipmap(gl.TEXTURE_2D);
    },
  };
}

/**
 * The level row a band of rows `[fromRow, toRow)` starts at. `UNPACK_FLIP_Y_WEBGL` flips a
 * typed-array band within its own rectangle only, so a flipped texture's band goes to the
 * mirrored rows, where the whole-image upload would put it.
 */
function levelRow(texture: THREE.Texture, fromRow: number, toRow: number): number {
  const { height } = texture.image as { height: number };
  return texture.flipY ? height - toRow : fromRow;
}
