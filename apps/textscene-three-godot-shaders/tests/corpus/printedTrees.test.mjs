/**
 * The printed tree of each corpus shader the transpiler accepts, as a checked-in file in
 * `trees/`. The testing chapter of the user guide says why, and why the GLSL gets no file.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { printShader } from '../../../../packages/textscene-core/src/shaders/language/printer.ts';
import { transpilerVerdict } from '../verdicts/judge.mjs';
import { treeOf } from '../verdicts/trees.testkit.mjs';
import { CORPUS } from './corpus.mjs';

const TREES_DIR = join(import.meta.dirname, 'trees');

/** The file of a shader's printed tree, beside the file of its text. */
const treeFile = (shader) => shader.file.replace(/\.gdshader$/, '.tree.txt');

/** The tree files of `files` that no shader of `accepted` owns. */
const staleTreeFiles = (files, accepted) => {
  const owned = new Set(accepted.map(treeFile));
  return files.filter((file) => file.endsWith('.tree.txt') && !owned.has(file));
};

const ACCEPTED = CORPUS.filter((shader) => transpilerVerdict(shader.text).accepted);

describe('the printed trees of the corpus', () => {
  it('holds the printed tree of each shader the transpiler accepts', async () => {
    for (const shader of ACCEPTED) {
      await expect(printShader(treeOf(shader.text))).toMatchFileSnapshot(join(TREES_DIR, treeFile(shader)));
    }
  });

  it('holds no tree of a shader the transpiler does not accept', () => {
    const files = existsSync(TREES_DIR) ? readdirSync(TREES_DIR, { recursive: true }) : [];
    expect(staleTreeFiles(files, ACCEPTED)).toEqual([]);
  });

  it('finds a tree file whose shader the transpiler no longer accepts', () => {
    const kept = { file: 'demos/kept.gdshader' };
    const files = ['demos/kept.tree.txt', 'demos/dropped.tree.txt', 'demos/notes.md'];
    expect(staleTreeFiles(files, [kept])).toEqual(['demos/dropped.tree.txt']);
  });
});
