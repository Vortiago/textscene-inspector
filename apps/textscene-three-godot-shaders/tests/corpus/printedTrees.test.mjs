/**
 * The printed tree of each corpus shader the transpiler accepts, as a checked-in file in
 * `trees/`, so a review shows how a change moves a real shader's tree. `vitest -u` writes a
 * moved tree. The generated GLSL gets no file: three writes it, and each upgrade of three would
 * change every file.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { printShader } from '../../../../packages/textscene-core/src/shaders/language/printer.ts';
import { transpilerVerdict } from '../verdicts/judge.mjs';
import { treeOf } from '../verdicts/trees.mjs';
import { CORPUS } from './corpus.mjs';

const TREES_DIR = join(import.meta.dirname, 'trees');

/** The file of a shader's printed tree, beside the file of its text. */
const treeFile = (shader) => shader.file.replace(/\.gdshader$/, '.tree.txt');

const ACCEPTED = CORPUS.filter((shader) => transpilerVerdict(shader.text).accepted);

describe('the printed trees of the corpus', () => {
  it('holds the printed tree of each shader the transpiler accepts', async () => {
    for (const shader of ACCEPTED) {
      await expect(printShader(treeOf(shader.text))).toMatchFileSnapshot(join(TREES_DIR, treeFile(shader)));
    }
  });

  it('holds no tree of a shader the transpiler does not accept', () => {
    const expected = new Set(ACCEPTED.map(treeFile));
    const files = existsSync(TREES_DIR) ? readdirSync(TREES_DIR, { recursive: true }) : [];
    expect(files.filter((file) => file.endsWith('.tree.txt') && !expected.has(file))).toEqual([]);
  });
});
