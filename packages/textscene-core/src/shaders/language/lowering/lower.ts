/**
 * The lowerings, in order: the tree the emitter reads holds `while (true)` as its one loop, no
 * `switch`, and a function's one `return` as its last statement. Each step gives a tree of
 * Godot's own nodes, which the tree check checks and Godot reads as text.
 */

import type { FunctionNode } from '../shaderTree.js';
import { FreshNames } from './freshNames.js';
import { lowerLoops } from './lowerLoops.js';
import { lowerReturns } from './lowerReturns.js';
import { lowerSwitches } from './lowerSwitches.js';

export function lowerFunction(definition: FunctionNode): FunctionNode {
  const names = new FreshNames(definition);
  return lowerReturns(lowerSwitches(lowerLoops(definition, names), names), names);
}
