import { vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { generatedFragmentShader } from '../generatedShader.testkit';
import { columnOf } from '../language/emitOperation.js';
import type { StructValue } from '../language/emitValue.js';
import type { StructNode } from '../language/shaderTree.js';
import { RowTexture } from './rowTexture.js';

const POSITION = { file: 't.glsl', line: 1, column: 1 };

const INSTANCE: StructNode = {
  kind: 'struct',
  name: 'Instance',
  members: [
    { name: 'transform', type: 'mat3x4' },
    { name: 'flags', type: 'uint' },
    { name: 'scale', type: 'float' },
  ],
  position: POSITION,
};

/** A fragment output that reads `value`, so three builds the read. */
const shown = (value: Node) => vec4(value as never) as unknown as Node;

const structOf = (type: string) => (type === 'Instance' ? INSTANCE : undefined);

function instancesBlock() {
  const rows = new RowTexture([{ name: 'data', type: 'Instance', isRuntimeSized: true }], 'std430', structOf);
  return { rows, data: (rows.value as StructValue).members.get('data') as { element(i: number): Value } };
}

type Value = Node | StructValue;

describe('RowTexture', () => {
  it('writes the words of a block into texels of four lanes each, a row of texels at a time', () => {
    const { rows } = instancesBlock();
    const rowTexels = rows.texture.image.width;
    rows.write(new Uint32Array(rowTexels * 4 + 4).fill(7));
    expect([rows.texture.image.width, rows.texture.image.height]).toEqual([rowTexels, 2]);
  });

  it('uploads its zero words before the first write, so the integer sampler reads an integer texture', () => {
    expect(instancesBlock().rows.texture.version).toBeGreaterThan(0);
  });

  it('reads a uint member from its lane of the texel its offset is in', () => {
    const { data } = instancesBlock();
    const flags = (data.element(1) as StructValue).members.get('flags') as Node;
    // Element 1 starts at byte 64, and flags is 48 bytes in: word 28, texel 7, lane x.
    expect(generatedFragmentShader(shown(flags))).toMatch(/ivec2\(\s*7,\s*0\s*\)/);
  });

  it('reads a float member as the float of its bits', () => {
    const { data } = instancesBlock();
    const scale = (data.element(0) as StructValue).members.get('scale') as Node;
    expect(generatedFragmentShader(shown(scale))).toContain('uintBitsToFloat');
  });

  it('reads a mat3x4 as the mat4 of its columns and a zero column, as the stage holds it', () => {
    const { data } = instancesBlock();
    const transform = (data.element(0) as StructValue).members.get('transform') as Node;
    expect(generatedFragmentShader(shown(columnOf(transform, 0)))).toMatch(/mat4\(/);
  });
});
