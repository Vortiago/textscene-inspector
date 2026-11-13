/**
 * The reduction of a random program that differs from Godot: a greedy search for a smaller
 * program that still differs, so a failure prints a program of a few nodes. A step replaces one
 * node with one of its children of the same type, or with a parameter or a literal of its type.
 */

import { childrenOf, programSource, rowsOf, treeNodes, withChild } from './programTree.mjs';

/**
 * The smallest program found from `program` for which `stillDiffers` holds. `stillDiffers` takes
 * a list of candidates and answers one boolean for each, so a caller can judge a whole round in
 * one Godot run and one page run.
 */
export async function reduceProgram(program, stillDiffers) {
  let current = program;
  for (;;) {
    const candidates = smallerPrograms(current);
    if (candidates.length === 0) return current;
    const verdicts = await stillDiffers(candidates);
    const index = verdicts.indexOf(true);
    if (index === -1) return current;
    current = candidates[index];
  }
}

/** Every program one step smaller than `program`, the smallest first. */
function smallerPrograms(program) {
  const size = treeNodes(program.tree).length;
  const trees = replacements(program.tree, program);
  return trees
    .map((tree) => ({ ...program, tree, rows: rowsOf(tree), source: programSource({ ...program, tree }) }))
    .filter((candidate) => treeNodes(candidate.tree).length < size)
    .sort((a, b) => treeNodes(a.tree).length - treeNodes(b.tree).length);
}

/** Each tree that `node`'s tree becomes when one of its nodes is replaced by a smaller one. */
function replacements(node, program) {
  const here = [...childrenOf(node).filter((child) => child.type === node.type), ...leavesOf(node, program)];
  const below = childrenOf(node).flatMap((child, index) =>
    replacements(child, program).map((smaller) => withChild(node, index, smaller))
  );
  return [...here.map(withoutSpareBrackets), ...below];
}

/** The parameters of `node`'s type, and a literal of it when the program holds one. */
function leavesOf(node, program) {
  if (node.kind === 'parameter' || node.kind === 'literal') return [];
  const parameters = program.parameters.flatMap((type, index) =>
    type === node.type ? [{ kind: 'parameter', type, index }] : []
  );
  const literal = treeNodes(program.tree).find((each) => each.kind === 'literal' && each.type === node.type);
  return literal ? [...parameters, literal] : parameters;
}

/** `node` with no spare brackets: they belonged to its old place in the tree. */
function withoutSpareBrackets(node) {
  const rest = { ...node };
  delete rest.bracketed;
  return rest;
}
