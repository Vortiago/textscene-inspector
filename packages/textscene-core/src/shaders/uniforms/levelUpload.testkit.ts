import type { Texture } from 'three';
import type { uploadLevels } from './levelUpload.js';

/** One `copyTextureToTexture` a renderer was asked for. */
export interface LevelCopy {
  readonly source: Texture;
  readonly target: Texture;
  readonly level: number;
}

/** A renderer that records each `copyTextureToTexture` it is asked for. */
export function recordingRenderer(): { copies: LevelCopy[]; renderer: Parameters<typeof uploadLevels>[0] } {
  const copies: LevelCopy[] = [];
  const glTextures = new WeakMap<Texture, { __webglTexture?: object }>();
  const renderer = {
    isWebGLRenderer: true,
    properties: {
      get: (texture: Texture) => glTextures.get(texture) ?? glTextures.set(texture, {}).get(texture)!,
    },
    copyTextureToTexture: (
      source: Texture,
      target: Texture,
      _region: null,
      _at: null,
      _from: number,
      level = 0
    ) => {
      glTextures.set(target, { __webglTexture: glTextures.get(target)?.__webglTexture ?? {} });
      copies.push({ source, target, level });
    },
  };
  return { copies, renderer: renderer as unknown as Parameters<typeof uploadLevels>[0] };
}
