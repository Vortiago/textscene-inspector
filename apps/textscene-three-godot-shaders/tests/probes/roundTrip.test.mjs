/**
 * Every probe source Godot accepts gives a tree that passes the tree check, and the printer
 * writes that tree as text the parser reads as the same tree.
 */

import { describe, expect, it } from 'vitest';
import { parse } from '../../../../packages/textscene-core/src/shaders/language/parse.ts';
import { printShader } from '../../../../packages/textscene-core/src/shaders/language/printer.ts';
import { tokenize } from '../../../../packages/textscene-core/src/shaders/language/tokenizer.ts';
import { treeFault } from '../../../../packages/textscene-core/src/shaders/language/treeCheck.ts';
import { PROBES } from './probes.mjs';

const RECORD = (await import('./godot-record.json', { with: { type: 'json' } })).default;

const accepted = PROBES.filter((probe) => !RECORD.probes[probe.name]?.rejected);

const treeOf = (source) => parse(tokenize(source));

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
});
