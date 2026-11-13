/**
 * The read of a resource above the one inner seam, "what does the loader hold at this file":
 * the hop from a reference to the resource it names, the decode cache and the cycle guard. Both
 * adapters of the seam, the loader's cache and a fixed map of files, run this same code. No THREE
 * and no React.
 */

import { warn } from '../../logger';
import { perObject } from '../../utils/perObject';
import { sameData } from '../../utils/sameData';
import type { ParsedResource } from '../../parser/parsedResource';
import type { CacheSource } from '../../r3f/cacheSources';
import type { SceneResources } from '../../r3f/SceneResourcesContext';
import { holdsResource } from '../../godot/scene/resourceLiteral';
import { scopedSection } from '../resourceSection';
import { resourceFilePath, subResourcePath } from '../subResourcePath';
import {
  findExtResource,
  findSubResource,
  parseResourceReference,
  loadsAsParsedResource,
  resolveExtResourcePath,
} from '../SubResourceResolver';
import { isLocalToScene } from '../textures/viewporttexture/localToScene';
import {
  IMPORTED_FILE,
  NONE,
  PENDING,
  UNAVAILABLE,
  type Follow,
  type HeldResource,
  type Read,
  type ResourceKind,
  type ResourceSnapshot,
} from './read';
import { referenceKey, type ScopedReference } from './scopedReference';

/** A resource a reference names, with what a nested reference written in it resolves in. */
interface Located {
  readonly held: HeldResource;
  /** The cycle guard key of the reference that reached it. */
  readonly key: string;
  /** Where the decode cache keeps its value: the address of a file resource, the class and id of a built-in one. */
  readonly slot: string;
  readonly resources: SceneResources;
  readonly origin: string | undefined;
}

/** A nested read a decode made, with the answer it got. */
interface FollowedRead {
  readonly kind: ResourceKind<unknown>;
  readonly ref: string | undefined;
  readonly answer: Read<unknown>;
}

interface Decoded {
  readonly properties: Readonly<Record<string, string>>;
  readonly isBuiltIn: boolean;
  readonly isHeldLocally: boolean;
  readonly reads: readonly FollowedRead[];
  /** The tables a reference the decode handed on resolves in, which the value holds. Null when it handed on none. */
  readonly handedTables: SceneResources | null;
  readonly answer: Read<unknown>;
}

/**
 * Written only by {@link decoded}: the last decode of each kind at each slot. An edit replaces the
 * entry of its slot, so the cache does not grow with edits.
 */
const slotsOf = perObject((_kind: ResourceKind<unknown>) => new Map<string, Decoded>());

/** A snapshot over `files`, the loader's answer for each file path: undefined while it loads, null once it failed. */
export function snapshotOver(files: CacheSource<ParsedResource>): ResourceSnapshot {
  return { read: (reference, kind) => readAt(files, reference, kind, []) };
}

function readAt<T>(
  files: CacheSource<ParsedResource>,
  reference: ScopedReference,
  kind: ResourceKind<T>,
  stack: readonly string[]
): Read<T> {
  const found = locate(files, reference);
  if (!('held' in found)) return found;
  if (!kind.accepts(found.held.type)) return UNAVAILABLE['wrong-type'];
  if (stack.includes(found.key)) return UNAVAILABLE.cycle;
  return decoded(files, found, kind, [...stack, found.key]);
}

function locate(files: CacheSource<ParsedResource>, reference: ScopedReference): Located | Read<never> {
  const { ref, resources } = reference;
  if (!holdsResource(ref)) return NONE;
  const parsed = parseResourceReference(ref!);
  if (parsed?.type === 'SubResource') {
    const section = findSubResource(resources.internalResources, parsed.id);
    if (!section) return UNAVAILABLE['unknown-id'];
    const address = reference.origin === undefined ? null : subResourcePath(reference.origin, parsed.id);
    return {
      held: heldOf(section.type, section.data, address, reference.isHeldLocally),
      key: referenceKey(reference),
      slot: address ?? `${section.type}|${parsed.id}`,
      resources,
      origin: reference.origin,
    };
  }
  if (parsed?.type === 'ExtResource' && !findExtResource(resources.externalResources, parsed.id)) {
    return UNAVAILABLE['unknown-id'];
  }
  const path = resolveExtResourcePath(ref, resources.externalResources);
  const filePath = path && resourceFilePath(path);
  if (!path || !filePath) return UNAVAILABLE['wrong-type'];
  // The module reads no file it does not parse: an image is held with no properties, for its reader to load.
  if (!loadsAsParsedResource(filePath)) return importedFile(path, reference);
  const file = files.getCached(filePath);
  if (file === undefined) return PENDING;
  if (file === null) return UNAVAILABLE['missing-file'];
  // Scoped per parse, so the tables keep their identity while the file holds.
  const section = scopedSection(file, path);
  if (!section) return UNAVAILABLE['unknown-id'];
  const { type, data } = section.resource;
  return {
    held: heldOf(type, data, path, reference.isHeldLocally),
    key: path,
    slot: path,
    resources: section.resources,
    origin: filePath,
  };
}

const NO_PROPERTIES: Readonly<Record<string, string>> = Object.freeze({});

function importedFile(path: string, reference: ScopedReference): Located {
  return {
    held: {
      type: IMPORTED_FILE,
      properties: NO_PROPERTIES,
      address: path,
      isLocalToScene: false,
      isHeldLocally: reference.isHeldLocally,
    },
    key: path,
    slot: path,
    resources: reference.resources,
    origin: undefined,
  };
}

function heldOf(
  type: string,
  properties: Readonly<Record<string, string>>,
  address: string | null,
  isHeldLocally: boolean
): HeldResource {
  return {
    type,
    properties,
    address,
    isLocalToScene: isLocalToScene({ id: '', type, data: properties }),
    isHeldLocally,
  };
}

/** A reference written in the resource `holder` names: the holder's tables, and the holder joins the chain. */
function nestedReference(holder: Located, ref: string | undefined): ScopedReference {
  return {
    ref,
    resources: holder.resources,
    origin: holder.origin,
    isHeldLocally: holder.held.isHeldLocally && holder.held.isLocalToScene,
  };
}

function decoded<T>(
  files: CacheSource<ParsedResource>,
  located: Located,
  kind: ResourceKind<T>,
  stack: readonly string[]
): Read<T> {
  const slots = slotsOf(kind);
  const kept = slots.get(located.slot);
  if (kept && stillHolds(kept, located, files, stack)) return kept.answer as Read<T>;

  const reads: FollowedRead[] = [];
  let handedTables: SceneResources | null = null;
  let isWaiting = false;
  const follow: Follow = {
    read(innerKind, ref) {
      const answer = readAt(files, nestedReference(located, ref), innerKind, stack);
      reads.push({ kind: innerKind, ref, answer });
      if (answer.status === 'pending') isWaiting = true;
      return answer;
    },
    reference(ref) {
      handedTables = located.resources;
      return nestedReference(located, ref);
    },
  };
  const value = decodeOnce(kind, located.held, follow);
  // Pending spreads upward: the value waits for the file a nested read named, and is not kept.
  if (isWaiting) return PENDING;
  const answer: Read<T> = value === null ? UNAVAILABLE.undecodable : { status: 'loaded', value };
  slots.set(located.slot, {
    properties: located.held.properties,
    isBuiltIn: located.held.address === null,
    isHeldLocally: located.held.isHeldLocally,
    reads,
    handedTables,
    answer,
  });
  return answer;
}

/** The decode's value, or null for a decode that declines or throws. A kept answer warns no more. */
function decodeOnce<T>(kind: ResourceKind<T>, held: HeldResource, follow: Follow): T | null {
  try {
    return kind.decode(held, follow);
  } catch (error) {
    warn(
      `[reading] ${kind.name} cannot decode the ${held.type} at ${held.address ?? 'the scene'}: ${String(error)}`
    );
    return null;
  }
}

/**
 * Whether the kept decode still describes the resource. A built-in resource is confirmed by its
 * strings, since each parse of the scene allocates it anew. A file resource is confirmed by the
 * object its parse holds, so a reload gives a new value. The slot already names the class.
 */
function stillHolds(
  kept: Decoded,
  located: Located,
  files: CacheSource<ParsedResource>,
  stack: readonly string[]
): boolean {
  const { held } = located;
  if (kept.isHeldLocally !== held.isHeldLocally) return false;
  const sameProperties = kept.isBuiltIn
    ? sameData(kept.properties, held.properties)
    : kept.properties === held.properties;
  return (
    sameProperties &&
    (kept.handedTables === null || kept.handedTables === located.resources) &&
    kept.reads.every(
      ({ kind, ref, answer }) => readAt(files, nestedReference(located, ref), kind, stack) === answer
    )
  );
}
