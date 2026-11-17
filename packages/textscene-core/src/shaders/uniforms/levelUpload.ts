/** Every level of a 2D array or a 3D texture, which three uploads at level 0 only (`WebGLTextures.js:1229`, `:1272`). */

import { Data3DTexture, DataArrayTexture, type Texture, type WebGLRenderer } from 'three';
import { NodeUpdateType, Texture3DNode, TextureNode, type NodeFrame } from 'three/webgpu';

interface Level {
  readonly data: ArrayBufferView;
  readonly width: number;
  readonly height: number;
  readonly depth?: number;
}

/** Written only by `uploadLevels`: the version of each texture whose levels its GL texture holds. */
// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const UPLOADED_VERSIONS = new WeakMap<Texture, number>();

const hasLevelsThreeSkips = (texture: Texture): texture is DataArrayTexture | Data3DTexture =>
  (texture instanceof DataArrayTexture || texture instanceof Data3DTexture) && texture.mipmaps.length > 1;

/** A level as a 3D texture: three copies a 3D source's data into a 2D array's level too. */
function levelSource(texture: DataArrayTexture | Data3DTexture, level: Level): Data3DTexture {
  const depth = level.depth ?? texture.image.depth;
  const source = new Data3DTexture(level.data as never, level.width, level.height, depth);
  source.format = texture.format;
  source.type = texture.type;
  return source;
}

/** Copies each level after the first into the texture's GL texture, once for each version of it. */
export function uploadLevels(renderer: WebGLRenderer, texture: Texture): void {
  if (!(renderer as { isWebGLRenderer?: boolean }).isWebGLRenderer || !hasLevelsThreeSkips(texture)) return;
  if (UPLOADED_VERSIONS.get(texture) === texture.version) return;
  (texture.mipmaps as Level[]).slice(1).forEach((level, index) => {
    renderer.copyTextureToTexture(levelSource(texture, level), texture, null, null, 0, index + 1);
  });
  UPLOADED_VERSIONS.set(texture, texture.version);
}

/** A 2D array node that uploads its levels before each draw: a clone keeps the class, and so the upload. */
export class LevelledTextureNode extends TextureNode {
  override updateType = NodeUpdateType.RENDER;

  override update(frame: NodeFrame): undefined {
    uploadLevels(frame.renderer as unknown as WebGLRenderer, this.value);
  }
}

/** A 3D texture node that uploads its levels before each draw. */
export class LevelledTexture3DNode extends Texture3DNode {
  override updateType = NodeUpdateType.RENDER;

  override update(frame: NodeFrame): undefined {
    uploadLevels(frame.renderer as unknown as WebGLRenderer, this.value);
  }
}
