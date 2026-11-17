import { describe, expect, it } from 'vitest';
import { DataArrayTexture, LinearFilter, LinearMipmapLinearFilter } from 'three';
import { texture, vec4 } from 'three/tsl';
import { NodeMaterial, type Node, type NodeFrame, type TextureNode } from 'three/webgpu';
import { generatedFragmentShader } from '../generatedShader.testkit.js';
import { CubeArrayReadNode } from './cubeArray.js';

const cubesOf = (minFilter: number) => {
  const cubes = new DataArrayTexture(new Uint8Array(4 * 6), 1, 1, 6);
  cubes.magFilter = LinearFilter;
  cubes.minFilter = minFilter as never;
  return cubes;
};

const disposalsAfterRebinding = (minFilter: number) => {
  const sampler = texture(cubesOf(LinearFilter)) as unknown as TextureNode;
  const read = new CubeArrayReadNode(sampler, vec4(1, 0, 0, 0) as unknown as Node, {
    kind: 'explicit',
    level: vec4(0).x as unknown as Node,
  });
  generatedFragmentShader(read as unknown as Node);
  sampler.value = cubesOf(minFilter);
  const material = new NodeMaterial();
  let disposals = 0;
  material.addEventListener('dispose', () => disposals++);
  read.update({ material } as unknown as NodeFrame);
  return disposals;
};

// A cube array read builds its filter into the program, which three keys apart from a function body.
describe('a node built from its bound texture', () => {
  it('disposes the material when the bound texture needs another program', () => {
    expect(disposalsAfterRebinding(LinearMipmapLinearFilter)).toBe(1);
  });

  it('keeps the material while the bound texture builds the same program', () => {
    expect(disposalsAfterRebinding(LinearFilter)).toBe(0);
  });
});
