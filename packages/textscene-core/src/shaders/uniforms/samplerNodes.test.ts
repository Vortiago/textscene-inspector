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
    node.update({} as NodeFrame);
    expect([node.updateType, copy.version]).toEqual([NodeUpdateType.RENDER, before + 1]);
  });

  it('follows the copy from a node three derives for a level', () => {
    const source = TEXTURES.flat();
    const copy = new TextureCopies(() => undefined).copyOf(source);
    const derived = samplerNodeOf('flat', copy).level(int(1));
    const before = copy.version;
    source.needsUpdate = true;
    derived.update({} as NodeFrame);
    expect(copy.version).toBe(before + 1);
  });
});
