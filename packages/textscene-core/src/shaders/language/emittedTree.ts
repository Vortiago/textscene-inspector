/**
 * The tree the emitter walks, from a parsed function: the tree GLSL reads from Godot's text of
 * it, with the constants glslang folds bound, then lowered. Godot's printed-text check reads the
 * same tree, so every step the emitter depends on is checked against Godot.
 */

import { writtenNames } from './assignment.js';
import { bindConstantReads } from './constantReads.js';
import { refuseFoldedIndexOutOfRange } from './foldedIndex.js';
import { refuseOutArgumentsThatAreNoPlace } from './outArgumentPlace.js';
import { GlslangFolding } from './glslangFolding.js';
import { glslBlock } from './godotText.js';
import { lowerFunction } from './lowering/lower.js';
import type { FunctionNode } from './shaderTree.js';

/**
 * A function's lowered tree, the constants glslang folds in it, and the names its body writes.
 * The folding knows its nodes by identity, so the lowerings move a node and never copy it.
 */
export interface EmittedTree {
  readonly lowered: FunctionNode;
  readonly folding: GlslangFolding;
  readonly written: ReadonlySet<string>;
}

export function emittedTree(definition: FunctionNode): EmittedTree {
  const folding = new GlslangFolding();
  const glsl = { ...definition, body: glslBlock(definition.body) };
  bindConstantReads(glsl.body, folding);
  refuseFoldedIndexOutOfRange(glsl.body, folding);
  refuseOutArgumentsThatAreNoPlace(glsl.body);
  const lowered = lowerFunction(glsl);
  return { lowered, folding, written: writtenNames(lowered.body) };
}
