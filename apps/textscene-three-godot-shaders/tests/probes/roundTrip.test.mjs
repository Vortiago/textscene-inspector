/**
 * Every probe source the parser reads gives a tree that passes the tree check, and the printer
 * writes that tree as text the parser reads as the same tree. The tree the emitter walks holds
 * both too, for every probe the transpiler does not refuse. The parser refuses what Godot's front
 * end refuses (`languageRefusals.test.mjs`), so this needs no answer from Godot.
 */

import { describe, expect, it } from 'vitest';
import { printShader } from '../../../../packages/textscene-core/src/shaders/language/printer.ts';
import { ShadingLanguageError } from '../../../../packages/textscene-core/src/shaders/language/shadingLanguageError.ts';
import { treeFault } from '../../../../packages/textscene-core/src/shaders/language/treeCheck.ts';
import { loweredFault, loweredTreeOf, shapeOf, treeOf } from '../verdicts/trees.testkit.mjs';
import { PROBES } from './probes.mjs';

/** The tree `make` gives of `source`, or nothing for the transpiler's refusal. */
function treeOrRefusal(make, source) {
  try {
    return make(source);
  } catch (error) {
    if (error instanceof ShadingLanguageError) return undefined;
    throw error;
  }
}

/**
 * The probes the transpiler parses and then refuses to lower: Godot's GLSL of each is refused by
 * the GPU compiler. A new refusal fails here, so no probe leaves the lowered set unseen.
 */
const REFUSED_AFTER_PARSE = [
  'index-folded-past-end',
  'index-folded-write-past-end',
  'unbracketed-operator-before',
  'unbracketed-negated',
];

/** Each probe's tree that `make` gives, made once, as `[name, tree]`. */
const treesOf = (make) =>
  PROBES.map((probe) => [probe.name, treeOrRefusal(make, probe.source)]).filter(([, tree]) => tree);

const PARSED = treesOf(treeOf);
const LOWERED = treesOf(loweredTreeOf);

describe.each(PARSED)('the parsed tree of probe %s', (_, tree) => {
  it('passes the tree check', () => {
    expect(treeFault(tree)).toBeUndefined();
  });

  it('prints as text that parses to the same tree', () => {
    expect(shapeOf(treeOf(printShader(tree)))).toEqual(shapeOf(tree));
  });
});

it('lowers every parsed probe but those whose GLSL the GPU compiler refuses', () => {
  const lowered = new Set(LOWERED.map(([name]) => name));
  expect(PARSED.map(([name]) => name).filter((name) => !lowered.has(name))).toEqual(REFUSED_AFTER_PARSE);
});

describe.each(LOWERED)('the lowered tree of probe %s', (_, lowered) => {
  it('passes the tree check and holds only what the emitter reads', () => {
    expect(loweredFault(lowered)).toBeUndefined();
  });

  it('prints as text that parses to the same tree', () => {
    expect(shapeOf(treeOf(printShader(lowered)))).toEqual(shapeOf(lowered));
  });
});
