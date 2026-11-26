import type * as THREE from 'three';
import type { TextureNode } from 'three/webgpu';

/** What decides a translated material's code apart from three's own program parameters. */
export interface CodeKey {
  /** The pass, and a hash of the translated text with each option that changes the code. */
  readonly source: string;
  /** The texture nodes the code samples, whose texture's type and filters change the code. */
  readonly textures: () => Iterable<TextureNode>;
}

/** `key` drawn in another pass of the same text, whose code differs. */
export const inPass = (key: CodeKey, pass: string): CodeKey => ({ ...key, source: `${pass}|${key.source}` });

/** The program key of `key`'s code with the textures its samplers read now. */
export function programKeyOf({ source, textures }: CodeKey): string {
  return `${source}|${[...textures()].map(textureKeyOf).join(';')}`;
}

/** three's own texture key (`TextureNode.js:274`), with the colour space, depth and comparison it reads. */
function textureKeyOf({ value }: TextureNode): string {
  const { type, minFilter, magFilter, colorSpace } = value;
  const { isDepthTexture, compareFunction } = value as Partial<THREE.DepthTexture>;
  return `${type},${minFilter},${magFilter},${colorSpace},${isDepthTexture === true},${compareFunction ?? ''}`;
}

/** A 53-bit hash (cyrb53) and the length of `text`: two texts collide with a chance near 2^-53. */
export function textHash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}.${text.length}`;
}
