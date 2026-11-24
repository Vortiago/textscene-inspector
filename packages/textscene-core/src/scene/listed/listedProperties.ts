import { descendsFromClass } from '../../godot/classdb/classBaseTypes.js';
import type { TscnInternalResource } from '../../parser/types.js';
import type { StoredValue } from '../derived/derivedProperty.js';
import type { GetOutcome } from '../propertyAccess.js';
import { meshSurfaceOverrides } from './meshSurfaceOverrides.js';
import { skeletonBones } from './skeletonBones.js';
import { tileMapLayers } from './tileMapLayers.js';

/** The texts a node's file and its instances lay on it, in the order `_set` applies them. */
export type NodeTexts = Readonly<Record<string, string>>;

/** What a class's `_get` reads of its node. */
export interface ListedReads {
  readonly texts: NodeTexts;
  readonly stored: StoredValue;
  /** The sub-resource a `res://…::id` path names, in the root scene or a loaded one, else null. */
  subResource(path: string): TscnInternalResource | null;
}

/** One class's `_get`. `unknown` for a name it does not route, `refused` where `_get` returns false. */
export type ListedGet = (property: string, reads: ListedReads) => GetOutcome;

/** Each ported `_get`, with the class whose descendants take it. */
const LISTED: readonly (readonly [baseClass: string, get: ListedGet])[] = [
  ['Skeleton3D', skeletonBones],
  ['TileMap', tileMapLayers],
  ['MeshInstance3D', meshSurfaceOverrides],
];

/** The `_get` of a property no ClassDB row names, such as a bone: `unknown` where none routes it. */
export function listedGet(className: string, property: string, reads: ListedReads): GetOutcome {
  for (const [base, get] of LISTED) {
    if (!descendsFromClass(className, base)) continue;
    const outcome = get(property, reads);
    if (outcome.kind !== 'unknown') return outcome;
  }
  return { kind: 'unknown' };
}
