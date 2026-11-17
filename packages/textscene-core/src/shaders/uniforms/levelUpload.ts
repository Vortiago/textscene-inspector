import { Data3DTexture, DataArrayTexture, type Texture, type WebGLRenderer } from 'three';

interface Level {
  readonly data: ArrayBufferView;
  readonly width: number;
  readonly height: number;
  readonly depth?: number;
}

/** Written only by `uploadLevels`: the texture version whose levels each GL texture holds. */
// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const UPLOADED_VERSIONS = new WeakMap<object, number>();

// The GL texture, not the texture: each renderer, and each restored context, has a GL texture of its own.
const glTextureOf = (renderer: WebGLRenderer, texture: Texture): object | undefined =>
  (renderer.properties.get(texture) as { __webglTexture?: object }).__webglTexture;

const hasLevelsThreeSkips = (texture: Texture): texture is DataArrayTexture | Data3DTexture =>
  (texture instanceof DataArrayTexture || texture instanceof Data3DTexture) && texture.mipmaps.length > 1;

/** A level as a 3D texture: three copies a 3D source's data into a 2D array's level too. */
function levelSource(texture: DataArrayTexture | Data3DTexture, level: Level, index: number): Data3DTexture {
  // A 3D texture's levels halve its depth, and a 2D array's keep every layer.
  const fullDepth = texture.image.depth;
  const depth =
    level.depth ?? (texture instanceof Data3DTexture ? Math.max(fullDepth >> index, 1) : fullDepth);
  const source = new Data3DTexture(level.data as never, level.width, level.height, depth);
  source.format = texture.format;
  source.type = texture.type;
  return source;
}

/** three uploads only level 0 of these (`WebGLTextures.js:1229`, `:1272`): this copies the rest. */
export function uploadLevels(renderer: WebGLRenderer, texture: Texture): void {
  if (!(renderer as { isWebGLRenderer?: boolean }).isWebGLRenderer || !hasLevelsThreeSkips(texture)) return;
  const before = glTextureOf(renderer, texture);
  if (before && UPLOADED_VERSIONS.get(before) === texture.version) return;
  (texture.mipmaps as Level[]).forEach((level, index) => {
    if (index > 0)
      renderer.copyTextureToTexture(levelSource(texture, level, index), texture, null, null, 0, index);
  });
  const uploaded = glTextureOf(renderer, texture);
  if (uploaded) UPLOADED_VERSIONS.set(uploaded, texture.version);
}
