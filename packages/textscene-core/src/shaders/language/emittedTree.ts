import { writtenNames } from './assignment.js';
import { bindConstantReads } from './constantReads.js';
import { refuseFoldedIndexOutOfRange } from './foldedIndex.js';
import { refuseOutArgumentsThatAreNoPlace } from './outArgumentPlace.js';
import { asWritten, GlslangFolding } from './glslangFolding.js';
import { godotConstantDouble } from './godotNumber.js';
import { glslBlock } from './godotText.js';
import { lowerFunction } from './lowering/lower.js';
import type { FunctionNode } from './shaderTree.js';

/** The folding knows its nodes by identity, so the lowerings move a node and never copy it. */
export interface EmittedTree {
  readonly lowered: FunctionNode;
  readonly folding: GlslangFolding;
  readonly written: ReadonlySet<string>;
}

export function emittedTree(definition: FunctionNode): EmittedTree {
  const glsl = { ...definition, body: glslBlock(definition.body) };
  return loweredTree(glsl, new GlslangFolding(godotConstantDouble));
}

/** The emitted tree of a template's function, which GLSL reads as it is. */
export function emittedGlslTree(glsl: FunctionNode): EmittedTree {
  return loweredTree(glsl, new GlslangFolding(asWritten));
}

function loweredTree(glsl: FunctionNode, folding: GlslangFolding): EmittedTree {
  bindConstantReads(glsl.body, folding);
  refuseFoldedIndexOutOfRange(glsl.body, folding);
  refuseOutArgumentsThatAreNoPlace(glsl.body);
  const lowered = lowerFunction(glsl);
  return { lowered, folding, written: writtenNames(lowered.body) };
}
