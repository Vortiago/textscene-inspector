import type { FunctionNode } from '../shaderTree.js';
import { FreshNames } from './freshNames.js';
import { lowerLoops } from './lowerLoops.js';
import { lowerReturns } from './lowerReturns.js';
import { lowerSideEffects } from './lowerSideEffects.js';
import { lowerSwitches } from './lowerSwitches.js';

export function lowerFunction(definition: FunctionNode): FunctionNode {
  const names = new FreshNames(definition);
  const ordered = lowerReturns(lowerSwitches(lowerLoops(definition, names), names), names);
  return lowerSideEffects(ordered, names);
}
