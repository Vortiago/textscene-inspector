import { bitAnd, select } from 'three/tsl';
import { type Composite, swizzles, tsl, unsignedNode } from './compositeParts.js';
import { CONSTRUCTORS, scalarNode } from './emitConstant.js';

// WebGL 2 has no subgroups, so each invocation is the one lane of its own subgroup, a size Vulkan allows.
const own: Composite = ([value]) => value!;

const ballot: Composite = ([vote]) =>
  CONSTRUCTORS.uvec4!(
    tsl(select)(vote!, unsignedNode(1), unsignedNode(0)),
    ...[1, 2, 3].map(() => unsignedNode(0))
  );

const ballotBitCount: Composite = ([bits]) => tsl(bitAnd)(swizzles(bits).x, unsignedNode(1));

export const SUBGROUP_COMPOSITES: Readonly<Record<string, Composite>> = {
  subgroupBallot: ballot,
  subgroupBallotBitCount: ballotBitCount,
  subgroupBallotExclusiveBitCount: () => unsignedNode(0),
  subgroupElect: () => scalarNode('bool', true),
  subgroupAll: own,
  subgroupAny: own,
  subgroupBroadcastFirst: own,
  subgroupMax: own,
  subgroupMin: own,
  subgroupOr: own,
  subgroupAdd: own,
};
