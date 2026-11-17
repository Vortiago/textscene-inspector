import type { ScalarKind } from './types.js';

/** Each operation of `GL_KHR_shader_subgroup_arithmetic`, with the identity its exclusive scan gives. */
export const SUBGROUP_ARITHMETIC: Readonly<Record<string, Readonly<Record<ScalarKind, number | boolean>>>> = {
  Add: { float: 0, int: 0, uint: 0, bool: false },
  Mul: { float: 1, int: 1, uint: 1, bool: true },
  Min: { float: Infinity, int: 2147483647, uint: 4294967295, bool: true },
  Max: { float: -Infinity, int: -2147483648, uint: 0, bool: false },
  And: { float: 0, int: -1, uint: 4294967295, bool: true },
  Or: { float: 0, int: 0, uint: 0, bool: false },
  Xor: { float: 0, int: 0, uint: 0, bool: false },
};

/** The arithmetic operations over bits, which take no float. */
export const BITWISE_SUBGROUP_OPERATIONS: readonly string[] = ['And', 'Or', 'Xor'];

/** Each arithmetic operation, by its name in `subgroup<Operation>`. */
export const SUBGROUP_OPERATIONS: readonly string[] = Object.keys(SUBGROUP_ARITHMETIC);

/** A read of another invocation reads the one invocation there is, so each gives its own operand. */
export const OWN_VALUE_SUBGROUP_FUNCTIONS: readonly string[] = [
  'subgroupAll',
  'subgroupAny',
  'subgroupBroadcast',
  'subgroupBroadcastFirst',
  'subgroupShuffle',
  'subgroupShuffleXor',
  'subgroupShuffleUp',
  'subgroupShuffleDown',
  'subgroupQuadBroadcast',
  'subgroupQuadSwapHorizontal',
  'subgroupQuadSwapVertical',
  'subgroupQuadSwapDiagonal',
];
