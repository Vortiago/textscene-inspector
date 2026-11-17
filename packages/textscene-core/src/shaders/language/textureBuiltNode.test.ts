import { describe, expect, it } from 'vitest';
import { DataArrayTexture, LinearFilter, LinearMipmapLinearFilter, NearestFilter } from 'three';
import { texture, vec4 } from 'three/tsl';
import { NodeMaterial, type Node, type NodeFrame, type TextureNode } from 'three/webgpu';
import { generatedFragmentShader } from '../generatedShader.testkit.js';
import { CubeArrayReadNode } from './cubeArray.js';

const cubesOf = (magFilter: number, minFilter: number) => {
  const cubes = new DataArrayTexture(new Uint8Array(4 * 6), 1, 1, 6);
  cubes.magFilter = magFilter as never;
  cubes.minFilter = minFilter as never;
  return cubes;
};

const disposalsAfterRebinding = (rebound: DataArrayTexture) => {
  const sampler = texture(cubesOf(LinearFilter, LinearFilter)) as unknown as TextureNode;
  const read = new CubeArrayReadNode(sampler, vec4(1, 0, 0, 0) as unknown as Node, {
    kind: 'explicit',
    level: vec4(0).x as unknown as Node,
  });
  generatedFragmentShader(read as unknown as Node);
  sampler.value = rebound;
  const material = new NodeMaterial();
  let disposals = 0;
  material.addEventListener('dispose', () => disposals++);
  read.update({ material } as unknown as NodeFrame);
  return disposals;
};

// A cube array read builds its filter into the program, which three keys apart from a function body.
describe('a node built from its bound texture', () => {
  it('disposes the material when the bound texture needs another program', () => {
    expect(disposalsAfterRebinding(cubesOf(NearestFilter, LinearFilter))).toBe(1);
  });

  it('keeps the material while the bound texture builds the same program', () => {
    expect(disposalsAfterRebinding(cubesOf(LinearFilter, LinearFilter))).toBe(0);
  });

  it('reads one level, as the same program, under a mipmap filter over a texture with no levels', () => {
    expect(disposalsAfterRebinding(cubesOf(LinearFilter, LinearMipmapLinearFilter))).toBe(0);
  });
});
