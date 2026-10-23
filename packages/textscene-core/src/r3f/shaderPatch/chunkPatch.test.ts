import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyEdits,
  editedChunk,
  editedProgram,
  editedShader,
  installChunkEdits,
  rewrittenShader,
  swappedChunk,
  type ChunkEdit,
} from './chunkPatch';
import { warningsOf } from '../testing/logWarnings';

const CHUNK = 'alphatest_fragment';
const REQUIRED_CHUNK = 'alphamap_fragment';
const threeChunk = THREE.ShaderChunk[CHUNK];
const threeRequiredChunk = THREE.ShaderChunk[REQUIRED_CHUNK];
const threeBasicShader = THREE.ShaderLib.basic.fragmentShader;

afterEach(() => {
  THREE.ShaderChunk[CHUNK] = threeChunk;
  THREE.ShaderChunk[REQUIRED_CHUNK] = threeRequiredChunk;
  THREE.ShaderLib.basic.fragmentShader = threeBasicShader;
});

describe('applyEdits', () => {
  it('replaces each edit’s text, in order', () => {
    expect(
      applyEdits('a b', [
        { three: 'a', godot: 'c' },
        { three: 'c b', godot: 'd' },
      ])
    ).toBe('d');
  });

  it('is null for a text that a later edit lacks (error case)', () => {
    expect(
      applyEdits('a', [
        { three: 'a', godot: 'c' },
        { three: 'a', godot: 'd' },
      ])
    ).toBeNull();
  });

  it('is the text itself for no edits (edge case)', () => {
    expect(applyEdits('a', [])).toBe('a');
  });

  it('replaces a block from its start through the first end after it', () => {
    expect(applyEdits('] a [ b ] c ]', [{ three: '[', until: ']', godot: 'd' }])).toBe('] a d c ]');
  });

  it('is null for a block whose end is missing after its start (error case)', () => {
    expect(applyEdits('] a [ b', [{ three: '[', until: ']', godot: 'd' }])).toBeNull();
  });

  it('keeps a `$` in the replacement literal (edge case)', () => {
    expect(applyEdits('a', [{ three: 'a', godot: "$&$'" }])).toBe("$&$'");
  });
});

describe('editedShader', () => {
  it('replaces each edit’s text, in order', () => {
    const edited = editedShader(
      'a b',
      [
        { three: 'a', godot: 'c' },
        { three: 'c b', godot: 'd' },
      ],
      'test program'
    );
    expect(edited).toBe('d');
  });

  it('keeps a `$` in the replacement literal (edge case)', () => {
    expect(editedShader('a', [{ three: 'a', godot: "$&$'" }], 'test program')).toBe("$&$'");
  });

  it('throws, naming the program, the text and the shader, for a text the shader lacks (error case)', () => {
    expect(() => editedShader('a b', [{ three: 'x', godot: 'c' }], 'the test program')).toThrow(
      'expected the test program to hold "x" once, got:\na b'
    );
  });

  it('throws for a text that occurs twice (edge case)', () => {
    expect(() => editedShader('a a', [{ three: 'a', godot: 'c' }], 'the test program')).toThrow(
      'expected the test program to hold "a" once'
    );
  });

  it('throws for a text that an earlier edit removed (error case)', () => {
    expect(() =>
      editedShader(
        'a',
        [
          { three: 'a', godot: 'c' },
          { three: 'a', godot: 'd' },
        ],
        'the test program'
      )
    ).toThrow('to hold "a" once, got:\nc');
  });
});

describe('editedProgram', () => {
  const program = () => ({ vertexShader: 'v1', fragmentShader: 'f1', uniforms: {} });

  it('edits the stage each list names, and leaves the other alone', () => {
    const shader = program();
    editedProgram(shader, { fragment: [{ three: 'f1', godot: 'f2' }] }, 'test patch');
    expect([shader.vertexShader, shader.fragmentShader]).toEqual(['v1', 'f2']);
  });

  it('edits both stages', () => {
    const shader = program();
    editedProgram(
      shader,
      { vertex: [{ three: 'v1', godot: 'v2' }], fragment: [{ three: 'f1', godot: 'f2' }] },
      'test patch'
    );
    expect([shader.vertexShader, shader.fragmentShader]).toEqual(['v2', 'f2']);
  });

  it('throws, naming the stage and the patch, for a stage that lacks a text (error case)', () => {
    expect(() => editedProgram(program(), { vertex: [{ three: 'x', godot: 'y' }] }, 'test patch')).toThrow(
      'expected the vertex shader of the test patch to hold "x" once, got:\nv1'
    );
  });
});

describe('rewrittenShader', () => {
  it('rewrites every match of the pattern', () => {
    expect(rewrittenShader('a1 b a2', /a(\d)/g, (_, digit) => `x${digit}`)).toBe('x1 b x2');
  });

  it('is the text itself for no match, which is no error (edge case)', () => {
    expect(rewrittenShader('b', /a/g, () => 'x')).toBe('b');
  });
});

describe('swappedChunk', () => {
  it('writes the text into three and is true', () => {
    expect(swappedChunk(CHUNK, 'two', 'test chunk has no stub')).toBe(true);
    expect(THREE.ShaderChunk[CHUNK]).toBe('two');
  });

  it('is false and warns nothing for the text the chunk holds (edge case)', () => {
    THREE.ShaderChunk[CHUNK] = 'two';
    expect(
      warningsOf(() => expect(swappedChunk(CHUNK, 'two', 'test chunk has no stub')).toBe(false))
    ).toEqual([]);
  });

  it('keeps the chunk, warns and is false for no text (error case)', () => {
    THREE.ShaderChunk[CHUNK] = 'one';
    expect(warningsOf(() => swappedChunk(CHUNK, null, 'test chunk has no stub'))).toEqual([
      "[Shading] three's test chunk has no stub",
    ]);
    expect(THREE.ShaderChunk[CHUNK]).toBe('one');
  });
});

describe('editedChunk', () => {
  // No installed patch edits `roughnessmap_fragment`, so three's own text stands in every test.
  const ROUGHNESS_READ = 'roughnessFactor *= texelRoughness.g;';

  it("applies the edit to three's chunk", () => {
    const edited = editedChunk('roughnessmap_fragment', { three: ROUGHNESS_READ, godot: 'masked();' });
    expect(edited).toBe(THREE.ShaderChunk.roughnessmap_fragment.replace(ROUGHNESS_READ, 'masked();'));
  });

  it('throws, naming the text and the chunk, for a text the chunk lacks (error case)', () => {
    expect(() => editedChunk('roughnessmap_fragment', { three: 'texelRoughness.q', godot: '' })).toThrow(
      `expected three's roughnessmap_fragment to hold "texelRoughness.q" once, got:\n`
    );
  });

  it('throws for a text that occurs twice in the chunk (edge case)', () => {
    expect(() => editedChunk('roughnessmap_fragment', { three: 'roughnessFactor', godot: '' })).toThrow(
      'to hold "roughnessFactor" once'
    );
  });
});

describe('installChunkEdits', () => {
  const swapEdits = [
    { chunk: CHUNK, three: 'one', godot: 'two' },
    { chunk: REQUIRED_CHUNK, three: 'three', godot: 'four' },
  ] as const;

  it('writes each edit into its chunk and is true', () => {
    THREE.ShaderChunk[CHUNK] = 'one';
    THREE.ShaderChunk[REQUIRED_CHUNK] = 'three';
    expect(installChunkEdits({ edits: swapEdits, mark: 'two', patch: 'swap' })).toBe(true);
    expect([THREE.ShaderChunk[CHUNK], THREE.ShaderChunk[REQUIRED_CHUNK]]).toEqual(['two', 'four']);
  });

  it('changes nothing and warns nothing when the chunk an edit writes the mark into holds it (edge case)', () => {
    THREE.ShaderChunk[CHUNK] = 'two one';
    THREE.ShaderChunk[REQUIRED_CHUNK] = 'three';
    const warnings = warningsOf(() => {
      expect(installChunkEdits({ edits: swapEdits, mark: 'two', patch: 'swap' })).toBe(true);
    });
    expect(warnings).toEqual([]);
    expect([THREE.ShaderChunk[CHUNK], THREE.ShaderChunk[REQUIRED_CHUNK]]).toEqual(['two one', 'three']);
  });

  it('leaves every chunk alone and is false when one lacks its text (error case)', () => {
    THREE.ShaderChunk[CHUNK] = 'one';
    THREE.ShaderChunk[REQUIRED_CHUNK] = 'absent';
    let installed = true;
    warningsOf(() => {
      installed = installChunkEdits({ edits: swapEdits, mark: 'two', patch: 'swap' });
    });
    expect(installed).toBe(false);
    expect([THREE.ShaderChunk[CHUNK], THREE.ShaderChunk[REQUIRED_CHUNK]]).toEqual(['one', 'absent']);
  });

  it('cuts a block from its start through its end', () => {
    THREE.ShaderChunk[CHUNK] = 'keep #if one #endif rest';
    const edits = [{ chunk: CHUNK, three: '#if', until: '#endif ', godot: 'two ' }] as const;
    installChunkEdits({ edits, mark: 'two', patch: 'cut' });
    expect(THREE.ShaderChunk[CHUNK]).toBe('keep two rest');
  });

  it('prepends each text after the edits', () => {
    THREE.ShaderChunk[CHUNK] = 'one';
    THREE.ShaderChunk[REQUIRED_CHUNK] = 'three';
    installChunkEdits({ edits: swapEdits, mark: 'two', patch: 'swap', prepend: { [CHUNK]: 'head ' } });
    expect(THREE.ShaderChunk[CHUNK]).toBe('head two');
  });

  it('appends each text after the edits', () => {
    THREE.ShaderChunk[CHUNK] = 'one';
    THREE.ShaderChunk[REQUIRED_CHUNK] = 'three';
    installChunkEdits({ edits: swapEdits, mark: 'two', patch: 'swap', append: { [CHUNK]: ' tail' } });
    expect(THREE.ShaderChunk[CHUNK]).toBe('two tail');
  });

  it('appends to a chunk that no edit names (edge case)', () => {
    THREE.ShaderChunk[CHUNK] = 'one';
    THREE.ShaderChunk[REQUIRED_CHUNK] = 'head';
    const edits: ChunkEdit<typeof CHUNK | typeof REQUIRED_CHUNK>[] = [
      { chunk: CHUNK, three: 'one', godot: 'two' },
    ];
    installChunkEdits({ edits, mark: 'two', patch: 'swap', append: { [REQUIRED_CHUNK]: ' tail' } });
    expect(THREE.ShaderChunk[REQUIRED_CHUNK]).toBe('head tail');
  });

  it("writes a program's fragment shader edits with the chunks", () => {
    THREE.ShaderChunk[CHUNK] = 'one';
    THREE.ShaderChunk[REQUIRED_CHUNK] = 'three';
    THREE.ShaderLib.basic.fragmentShader = 'basic';
    const fragmentShaders = { basic: [{ three: 'basic', godot: 'godot' }] };
    installChunkEdits({ edits: swapEdits, mark: 'two', patch: 'swap', fragmentShaders });
    expect(THREE.ShaderLib.basic.fragmentShader).toBe('godot');
  });

  it("leaves the chunks alone when a program lacks an edit's text (error case)", () => {
    THREE.ShaderChunk[CHUNK] = 'one';
    THREE.ShaderChunk[REQUIRED_CHUNK] = 'three';
    const fragmentShaders = { basic: [{ three: 'absent', godot: 'godot' }] };
    expect(
      warningsOf(() => installChunkEdits({ edits: swapEdits, mark: 'two', patch: 'swap', fragmentShaders }))
    ).toHaveLength(1);
    expect(THREE.ShaderChunk[CHUNK]).toBe('one');
  });

  it('installs once each chunk holds the text of every patch it requires there', () => {
    THREE.ShaderChunk[CHUNK] = 'one';
    THREE.ShaderChunk[REQUIRED_CHUNK] = 'three, earlier patch, later patch';
    const requires = { [REQUIRED_CHUNK]: ['earlier', 'later'] };
    expect(installChunkEdits({ edits: swapEdits, mark: 'two', patch: 'swap', requires })).toBe(true);
  });

  it('leaves the chunks alone and names the chunk that lacks a required patch (error case)', () => {
    THREE.ShaderChunk[CHUNK] = 'one';
    THREE.ShaderChunk[REQUIRED_CHUNK] = 'three, earlier patch';
    const requires = { [REQUIRED_CHUNK]: ['earlier', 'later'] };
    expect(
      warningsOf(() => installChunkEdits({ edits: swapEdits, mark: 'two', patch: 'swap', requires }))
    ).toEqual([
      `[Shading] the patch of ${CHUNK}, ${REQUIRED_CHUNK} reads a patch missing from ${REQUIRED_CHUNK}`,
    ]);
    expect(THREE.ShaderChunk[CHUNK]).toBe('one');
  });

  it('names every edited chunk, each edited program and the patch when a text is missing (error case)', () => {
    THREE.ShaderChunk[CHUNK] = 'one';
    THREE.ShaderChunk[REQUIRED_CHUNK] = 'absent';
    const fragmentShaders = { basic: [{ three: 'basic', godot: 'godot' }] };
    expect(
      warningsOf(() => installChunkEdits({ edits: swapEdits, mark: 'two', patch: 'swap', fragmentShaders }))
    ).toEqual([
      `[Shading] three's ${CHUNK}, ${REQUIRED_CHUNK} or basic fragment shader lacks a line the swap patch replaces`,
    ]);
    expect(THREE.ShaderChunk[CHUNK]).toBe('one');
  });

  it('throws for a mark that no edit writes (error case)', () => {
    expect(() => installChunkEdits({ edits: swapEdits, mark: 'absent', patch: 'swap' })).toThrow(
      'expected an edit of the swap patch to write its mark "absent"'
    );
  });
});
