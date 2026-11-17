import { Data3DTexture, DataArrayTexture, type Texture, type WebGLRenderer } from 'three';

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

/** three uploads level 0 only of these (`WebGLTextures.js:1229`, `:1272`), so this copies every later level. */
export function uploadLevels(renderer: WebGLRenderer, texture: Texture): void {
  if (!(renderer as { isWebGLRenderer?: boolean }).isWebGLRenderer || !hasLevelsThreeSkips(texture)) return;
  if (UPLOADED_VERSIONS.get(texture) === texture.version) return;
  (texture.mipmaps as Level[]).slice(1).forEach((level, index) => {
    renderer.copyTextureToTexture(levelSource(texture, level), texture, null, null, 0, index + 1);
  });
  UPLOADED_VERSIONS.set(texture, texture.version);
}
