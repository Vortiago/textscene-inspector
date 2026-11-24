import { int, uniform, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { generatedFragmentShader } from '../generatedShader.testkit';
import { columnOf } from '../language/emitOperation.js';
import type { StructValue } from '../language/emitValue.js';
import type { StructNode } from '../language/shaderTree.js';
import { RowBlock } from './rowBlock.js';

const POSITION = { file: 't.glsl', line: 1, column: 1 };

/** An element index the stage computes, so the read cannot fold to a constant texel. */
const intIndex = int(uniform(1)) as unknown as Node;

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
  const rows = new RowBlock([{ name: 'data', type: 'Instance', isRuntimeSized: true }], 'std430', structOf);
  return {
    rows,
    data: (rows.value as StructValue).members.get('data') as { element(i: Node | number): Value },
  };
}

type Value = Node | StructValue;

describe('RowBlock', () => {
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
    expect(generatedFragmentShader(shown(flags))).toMatch(/ivec2\(\s*7,\s*\(?\s*0\s*\+/);
  });

  it('steps through an array of no size at the stride std430 gives its element, 16 bytes for a vec3', () => {
    const rows = new RowBlock([{ name: 'points', type: 'vec3', isRuntimeSized: true }], 'std430', structOf);
    const points = (rows.value as StructValue).members.get('points') as { element(i: number): Value };
    const text = generatedFragmentShader(shown(points.element(1) as Node));
    expect(text).toMatch(/ivec2\(\s*1,\s*\(?\s*0\s*\+/);
    expect(text).not.toMatch(/ivec2\(\s*0,/);
  });

  it('reads the four words of a column that stays in one texel with one fetch', () => {
    const { data } = instancesBlock();
    const transform = (data.element(intIndex) as StructValue).members.get('transform') as Node;
    const text = generatedFragmentShader(shown(columnOf(transform, 0)));
    expect(text.match(/texelFetch/g)).toHaveLength(3);
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

describe('RowBlock.writeEachDraw', () => {
  /** A WebGLRenderer that has uploaded `rows`' texture once, and records each upload after it. */
  function rendererFor(rows: RowBlock) {
    const uploads: number[] = [];
    const properties = { __webglTexture: {}, __version: rows.texture.version };
    const gl = {
      TEXTURE_2D: 1,
      TEXTURE_BINDING_2D: 2,
      getParameter: () => null,
      bindTexture: () => undefined,
      texSubImage2D: (...args: unknown[]) => uploads.push((args.at(-1) as Uint32Array)[0]!),
    };
    const renderer = {
      properties: { get: () => properties },
      getContext: () => gl,
      state: { pixelStorei: () => undefined },
    };
    return { renderer, uploads, properties };
  }

  /** Draws `object` as the draw `renderId` of the node handler. */
  const draw = (rows: RowBlock, renderer: object, renderId: number, object: object) =>
    rows['store'].node.update({ renderer, renderId, object } as never);

  const wordsOf = (object: { word: number }) => new Uint32Array([object.word]);

  it('uploads the words of a draw that follows a draw of the same material', () => {
    const { rows } = instancesBlock();
    const { renderer, uploads } = rendererFor(rows);
    rows.writeEachDraw(wordsOf as never);
    draw(rows, renderer, 1, { word: 5 });
    draw(rows, renderer, 2, { word: 9 });
    expect(uploads).toEqual([9]);
  });

  it('leaves the upload to three after a draw of another material', () => {
    const { rows } = instancesBlock();
    const { renderer, uploads } = rendererFor(rows);
    rows.writeEachDraw(wordsOf as never);
    draw(rows, renderer, 1, { word: 5 });
    draw(rows, renderer, 3, { word: 9 });
    expect(uploads).toEqual([]);
  });

  it('leaves a texture this renderer has not uploaded yet to three', () => {
    const { rows } = instancesBlock();
    const { renderer, uploads, properties } = rendererFor(rows);
    properties.__webglTexture = undefined as never;
    rows.writeEachDraw(wordsOf as never);
    draw(rows, renderer, 1, { word: 5 });
    draw(rows, renderer, 2, { word: 9 });
    expect(uploads).toEqual([]);
  });
});
