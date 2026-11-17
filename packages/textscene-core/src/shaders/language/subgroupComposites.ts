import { bitAnd, notEqual, select, shiftRight } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { byLane, type Composite, swizzles, tsl, unsignedNode } from './compositeParts.js';
import { CONSTRUCTORS, scalarNode } from './emitConstant.js';
import { element } from './emitOperation.js';
import { OWN_VALUE_SUBGROUP_FUNCTIONS, SUBGROUP_ARITHMETIC } from './subgroupOperations.js';
import { shapeOf, type ScalarKind } from './types.js';

// WebGL 2 has no subgroups, so each invocation is the one lane of its own subgroup, a size Vulkan allows.
const own: Composite = ([value]) => value!;

/** A scan that leaves out the invocation's own value gives the operation's identity. */
const identity =
  (value: Readonly<Record<ScalarKind, number | boolean>>): Composite =>
  (_operands, [type]) =>
    byLane(type!, () => scalarNode(shapeOf(type!)!.scalar, value[shapeOf(type!)!.scalar]));

const ballot: Composite = ([vote]) =>
  CONSTRUCTORS.uvec4!(
    tsl(select)(vote!, unsignedNode(1), unsignedNode(0)),
    ...[1, 2, 3].map(() => unsignedNode(0))
  );

/** Bit 0 of a ballot: the one invocation's own bit. A bit of no invocation is left out. */
const ownBit: Composite = ([bits]) => tsl(bitAnd)(swizzles(bits).x, unsignedNode(1));

const ballotBitExtract: Composite = ([bits, index]) => {
  const word = element(bits!, tsl(shiftRight)(index!, unsignedNode(5)));
  return tsl(notEqual)(
    tsl(bitAnd)(tsl(shiftRight)(word, tsl(bitAnd)(index!, unsignedNode(31))), unsignedNode(1)),
    unsignedNode(0)
  );
};

export const SUBGROUP_COMPOSITES: Readonly<Record<string, Composite>> = {
  ...Object.fromEntries(OWN_VALUE_SUBGROUP_FUNCTIONS.map((name) => [name, own])),
  ...Object.fromEntries(
    Object.entries(SUBGROUP_ARITHMETIC).flatMap(([operation, value]) => [
      [`subgroup${operation}`, own],
      [`subgroupInclusive${operation}`, own],
      [`subgroupClustered${operation}`, own],
      [`subgroupExclusive${operation}`, identity(value)],
    ])
  ),
  subgroupElect: () => scalarNode('bool', true),
  subgroupAllEqual: () => scalarNode('bool', true),
  subgroupBallot: ballot,
  subgroupInverseBallot: ([bits]) => tsl(notEqual)(ownBit([bits!], ['uvec4']), unsignedNode(0)),
  subgroupBallotBitExtract: ballotBitExtract,
  subgroupBallotBitCount: ownBit,
  subgroupBallotInclusiveBitCount: ownBit,
  subgroupBallotExclusiveBitCount: () => unsignedNode(0),
  // The one bit a ballot may hold is bit 0, and a ballot of no bit leaves the result undefined.
  subgroupBallotFindLSB: () => unsignedNode(0),
  subgroupBallotFindMSB: () => unsignedNode(0),
};

/** The `gl_Subgroup*` variables of the one invocation: lane 0 of a subgroup of one. */
export function subgroupVariables(): ReadonlyMap<string, Node> {
  const mask = (isOwn: boolean) =>
    CONSTRUCTORS.uvec4!(unsignedNode(isOwn ? 1 : 0), ...[1, 2, 3].map(() => unsignedNode(0)));
  return new Map([
    ['gl_SubgroupSize', unsignedNode(1)],
    ['gl_SubgroupInvocationID', unsignedNode(0)],
    ['gl_SubgroupEqMask', mask(true)],
    ['gl_SubgroupGeMask', mask(true)],
    ['gl_SubgroupLeMask', mask(true)],
    ['gl_SubgroupGtMask', mask(false)],
    ['gl_SubgroupLtMask', mask(false)],
  ]);
}
