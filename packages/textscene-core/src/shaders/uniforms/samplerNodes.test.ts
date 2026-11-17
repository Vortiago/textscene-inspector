import { describe, expect, it } from 'vitest';
import { CubeTexture, Data3DTexture, DataArrayTexture, DataTexture, type Texture } from 'three';
import { int } from 'three/tsl';
import { NodeUpdateType, type NodeFrame } from 'three/webgpu';
import type { TextureKind } from '../language/types.js';
import { samplerNodeOf } from './samplerNodes.js';
import { TextureCopies } from './textureCopies.js';

const TEXTURES: Readonly<Record<TextureKind, () => Texture>> = {
  flat: () => new DataTexture(new Uint8Array(4), 1, 1),
  layers: () => new DataArrayTexture(new Uint8Array(4), 1, 1, 1),
  cubes: () => new DataArrayTexture(new Uint8Array(24), 1, 1, 6),
  volume: () => new Data3DTexture(new Uint8Array(4), 1, 1, 1),
  cube: () => new CubeTexture(),
};

describe('samplerNodeOf', () => {
  it.each(Object.keys(TEXTURES) as TextureKind[])('follows the copy of a %s before each render', (kind) => {
    const source = TEXTURES[kind]();
    const copy = new TextureCopies(() => undefined).copyOf(source);
    const node = samplerNodeOf(kind, copy);
    const before = copy.version;
    source.needsUpdate = true;
    node.update({ renderer: {} } as unknown as NodeFrame);
    expect([node.updateType, copy.version]).toEqual([NodeUpdateType.RENDER, before + 1]);
  });

  it('follows the copy from a node three derives for a level', () => {
    const source = TEXTURES.flat();
    const copy = new TextureCopies(() => undefined).copyOf(source);
    const derived = samplerNodeOf('flat', copy).level(int(1));
    const before = copy.version;
    source.needsUpdate = true;
    derived.update({ renderer: {} } as unknown as NodeFrame);
    expect(copy.version).toBe(before + 1);
  });

  it.each(['layers', 'volume'] as const)('uploads every level of a %s before each render', (kind) => {
    const source = TEXTURES[kind]() as DataArrayTexture | Data3DTexture;
    source.mipmaps = [1, 1].map(() => ({ data: new Uint8Array(4), width: 1, height: 1, depth: 1 })) as never;
    const copy = new TextureCopies(() => undefined).copyOf(source);
    const levels: number[] = [];
    const renderer = {
      isWebGLRenderer: true,
      copyTextureToTexture: (...args: unknown[]) => levels.push(args[5] as number),
    };
    samplerNodeOf(kind, copy).update({ renderer } as unknown as NodeFrame);
    expect(levels).toEqual([1]);
  });
});
