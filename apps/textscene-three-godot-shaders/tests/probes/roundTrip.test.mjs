/**
 * Every probe source the parser reads gives a tree that passes the tree check, and the printer
 * writes that tree as text the parser reads as the same tree. The tree the emitter walks holds
 * both too, for every probe the transpiler does not refuse. The parser refuses what Godot's front
 * end refuses (`languageRefusals.test.mjs`), so this needs no answer from Godot.
 */

import { describe, expect, it } from 'vitest';
import { emittedTree } from '../../../../packages/textscene-core/src/shaders/language/emittedTree.ts';
import { parse } from '../../../../packages/textscene-core/src/shaders/language/parse.ts';
import { printShader } from '../../../../packages/textscene-core/src/shaders/language/printer.ts';
import { ShadingLanguageError } from '../../../../packages/textscene-core/src/shaders/language/shadingLanguageError.ts';
import { tokenize } from '../../../../packages/textscene-core/src/shaders/language/tokenizer.ts';
import { treeFault } from '../../../../packages/textscene-core/src/shaders/language/treeCheck.ts';
import { PROBES } from './probes.mjs';

const treeOf = (source) => parse(tokenize(source));

const loweredTreeOf = (source) => {
  const tree = treeOf(source);
  return { ...tree, functions: tree.functions.map((definition) => emittedTree(definition).lowered) };
};

/** Whether `make` gives a tree of `source`, not the transpiler's refusal. */
function gives(make, source) {
  try {
    make(source);
    return true;
  } catch (error) {
    if (error instanceof ShadingLanguageError) return false;
    throw error;
  }
}

const sourcesWhere = (make) =>
  PROBES.filter((probe) => gives(make, probe.source)).map((probe) => [probe.name, probe.source]);

/** `tree` without the positions, which differ between a text and its printed form. */
const shapeOf = (tree) =>
  JSON.parse(JSON.stringify(tree, (key, value) => (key === 'position' ? undefined : value)));

describe.each(sourcesWhere(treeOf))('the parsed tree of probe %s', (_, source) => {
  it('passes the tree check', () => {
    expect(treeFault(treeOf(source))).toBeUndefined();
  });

  it('prints as text that parses to the same tree', () => {
    const tree = treeOf(source);
    expect(shapeOf(treeOf(printShader(tree)))).toEqual(shapeOf(tree));
  });
});

describe.each(sourcesWhere(loweredTreeOf))('the lowered tree of probe %s', (_, source) => {
  it('passes the tree check', () => {
    expect(treeFault(loweredTreeOf(source))).toBeUndefined();
  });

  it('prints as text that parses to the same tree', () => {
    const lowered = loweredTreeOf(source);
    expect(shapeOf(treeOf(printShader(lowered)))).toEqual(shapeOf(lowered));
  });
});
