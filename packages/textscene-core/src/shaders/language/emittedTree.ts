/**
 * The tree the emitter walks, from a parsed function: the tree GLSL reads from Godot's text of
 * it, with the constants glslang folds bound, then lowered. Godot's printed-text check reads the
 * same tree, so every step the emitter depends on is checked against Godot.
 */

import { bindConstantReads } from './constantReads.js';
import { refuseFoldedIndexOutOfRange } from './foldedIndex.js';
import { GlslangFolding } from './glslangFolding.js';
import { glslBlock } from './godotText.js';
import { lowerFunction } from './lowering/lower.js';
import type { FunctionNode } from './shaderTree.js';

/**
 * The lowered tree of `definition` and the constants glslang folds in it. The folding knows its
 * nodes by identity, so the lowerings move a node and never copy it.
 */
export function emittedTree(definition: FunctionNode): { lowered: FunctionNode; folding: GlslangFolding } {
  const folding = new GlslangFolding();
  const glsl = { ...definition, body: glslBlock(definition.body) };
  bindConstantReads(glsl.body, folding);
  refuseFoldedIndexOutOfRange(glsl.body, folding);
  return { lowered: lowerFunction(glsl), folding };
}
