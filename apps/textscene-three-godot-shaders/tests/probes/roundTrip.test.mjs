/**
 * Every probe source the parser reads gives a tree that passes the tree check, and the printer
 * writes that tree as text the parser reads as the same tree. The lowered tree holds both too.
 * The parser refuses what Godot's front end refuses (`languageRefusals.test.mjs`), so this
 * needs no answer from Godot.
 */

import { describe, expect, it } from 'vitest';
import { parse } from '../../../../packages/textscene-core/src/shaders/language/parse.ts';
import { lowerFunction } from '../../../../packages/textscene-core/src/shaders/language/lowering/lower.ts';
import { printShader } from '../../../../packages/textscene-core/src/shaders/language/printer.ts';
import { ShadingLanguageError } from '../../../../packages/textscene-core/src/shaders/language/shadingLanguageError.ts';
import { tokenize } from '../../../../packages/textscene-core/src/shaders/language/tokenizer.ts';
import { treeFault } from '../../../../packages/textscene-core/src/shaders/language/treeCheck.ts';
import { PROBES } from './probes.mjs';

const treeOf = (source) => parse(tokenize(source));

/** Whether the parser reads `source`. */
function parses(source) {
  try {
    treeOf(source);
    return true;
  } catch (error) {
    if (error instanceof ShadingLanguageError) return false;
    throw error;
  }
}

const accepted = PROBES.filter((probe) => parses(probe.source));

const loweredTreeOf = (source) => {
  const tree = treeOf(source);
  return { ...tree, functions: tree.functions.map(lowerFunction) };
};

/** `tree` without the positions, which differ between a text and its printed form. */
const shapeOf = (tree) =>
  JSON.parse(JSON.stringify(tree, (key, value) => (key === 'position' ? undefined : value)));

describe.each(accepted.map((probe) => [probe.name, probe.source]))('probe %s', (_, source) => {
  it('passes the tree check', () => {
    expect(treeFault(treeOf(source))).toBeUndefined();
  });

  it('prints as text that parses to the same tree', () => {
    const tree = treeOf(source);
    expect(shapeOf(treeOf(printShader(tree)))).toEqual(shapeOf(tree));
  });

  it('lowers to a tree that passes the tree check', () => {
    expect(treeFault(loweredTreeOf(source))).toBeUndefined();
  });

  it('lowers to a tree that prints as text that parses to the same tree', () => {
    const lowered = loweredTreeOf(source);
    expect(shapeOf(treeOf(printShader(lowered)))).toEqual(shapeOf(lowered));
  });
});
