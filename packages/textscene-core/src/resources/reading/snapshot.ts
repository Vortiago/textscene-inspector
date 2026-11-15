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
import { LOAD_OUTCOMES, type FileKind } from '../fileKinds';
import type { LoadOutcome } from '../loadFailure/loadOutcome';
import { isGodotTextResourcePath } from '../../godot/project/resourceFormats';
import type { CachedFile } from '../useLoadedFiles';
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

/** A read a decode made, with the answer it got: a nested resource, or a processor's value for the holder. */
type FollowedRead =
  | { readonly kind: ResourceKind<unknown>; readonly ref: string | undefined; readonly answer: Read<unknown> }
  | { readonly fileKind: FileKind<object>; readonly address: string; readonly answer: Read<unknown> };

interface Decoded {
  readonly properties: Readonly<Record<string, string>>;
  readonly isBuiltIn: boolean;
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

/** The loader's answer for each file path, undefined while it loads and null once it failed. */
export interface FileSource extends CacheSource<ParsedResource> {
  /**
   * The value the processor of `fileKind` built for `address`, undefined while it loads and null once
   * it failed. A source with no processors answers each one failed.
   */
  readonly loaded?: (fileKind: FileKind<object>, address: string) => CachedFile<object>;
  /** Hears each `file::id` address a read found in a loaded file: the file, or null when it declares no such id. */
  readonly onAddress?: (address: string, file: ParsedResource | null) => void;
}

/** A snapshot over `files`. */
export function snapshotOver(files: FileSource): ResourceSnapshot {
  return {
    read: (reference, kind) => readAt(files, reference, kind, []),
    loaded: (fileKind, address) => loadedAt(files, fileKind, address),
  };
}

/** The loader's answer before any file loads, which `mayName` reads against. */
const NOTHING_LOADED: FileSource = { getCached: () => undefined, loaded: () => undefined };

/**
 * Whether `reference` can name a `kind` before any file loads: false for an unknown id and for a
 * resource of another class, as Godot refuses the property. A file still to load can name one.
 */
export function mayName(reference: ScopedReference, kind: ResourceKind<unknown>): boolean {
  const found = locate(NOTHING_LOADED, reference, kind);
  if (!('held' in found)) return found.status === 'pending';
  return kind.accepts(found.held.type);
}

function readAt<T>(
  files: FileSource,
  reference: ScopedReference,
  kind: ResourceKind<T>,
  stack: readonly string[]
): Read<T> {
  const found = locate(files, reference, kind);
  if (!('held' in found)) return found;
  if (!kind.accepts(found.held.type)) return UNAVAILABLE['wrong-type'];
  if (stack.includes(found.key)) return UNAVAILABLE.cycle;
  return decoded(files, found, kind, [...stack, found.key]);
}

/** One answer object for each value, so an unchanged value keeps the identity of its answer. */
const loadedAnswerOf = perObject((value: object): Read<object> => ({ status: 'loaded', value }));

function loadedAt<U extends object>(files: FileSource, fileKind: FileKind<U>, address: string): Read<U> {
  const value = files.loaded ? files.loaded(fileKind as FileKind<object>, address) : null;
  if (value === undefined) return PENDING;
  if (value === null) return UNAVAILABLE['missing-file'];
  // The source answers from the cache of `fileKind`, which holds a U.
  return loadedAnswerOf(value) as Read<U>;
}

function locate(
  files: FileSource,
  reference: ScopedReference,
  kind: ResourceKind<unknown>
): Located | Read<never> {
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
  const ext =
    parsed?.type === 'ExtResource' ? findExtResource(resources.externalResources, parsed.id) : undefined;
  if (parsed?.type === 'ExtResource' && !ext) return UNAVAILABLE['unknown-id'];
  const path = resolveExtResourcePath(ref, resources.externalResources);
  const filePath = path && resourceFilePath(path);
  if (!path || !filePath) return UNAVAILABLE['wrong-type'];
  if (kind.readsFilesWhole) return heldWhole(path, ext?.type ?? IMPORTED_FILE, reference);
  // The module reads no file it does not parse: an image is held with no properties, for its reader to load.
  if (!loadsAsParsedResource(filePath)) return heldWhole(path, IMPORTED_FILE, reference);
  const file = files.getCached(filePath);
  if (file === undefined) return PENDING;
  if (file === null || failsToLoad(files, filePath)) return UNAVAILABLE['missing-file'];
  // Scoped per parse, so the tables keep their identity while the file holds.
  const section = scopedSection(file, path);
  if (path !== filePath) files.onAddress?.(path, section ? file : null);
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

/** An outcome still to load, and a source with none, loads. */
function failsToLoad(files: FileSource, filePath: string): boolean {
  if (!files.loaded || !isGodotTextResourcePath(filePath)) return false;
  const outcome = files.loaded(LOAD_OUTCOMES as FileKind<object>, filePath) as LoadOutcome | null | undefined;
  return outcome?.isFailed === true;
}

const NO_PROPERTIES: Readonly<Record<string, string>> = Object.freeze({});

/** A file the module does not parse, held with no properties for a processor to read. */
function heldWhole(path: string, type: string, reference: ScopedReference): Located {
  return {
    held: {
      type,
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
  files: FileSource,
  located: Located,
  kind: ResourceKind<T>,
  stack: readonly string[]
): Read<T> {
  const slots = slotsOf(kind);
  // A slot for each holding: a resource read both ways keeps both values, and its texture with them.
  const slot = `${located.slot}|${located.held.isHeldLocally ? 'local' : 'shared'}`;
  const kept = slots.get(slot);
  if (kept && stillHolds(kept, located, files, stack)) return kept.answer as Read<T>;

  const reads: FollowedRead[] = [];
  let handedTables: SceneResources | null = null;
  let isWaiting = false;
  const follow: Follow = {
    read(innerKind, ref) {
      const answer = follow.readWithoutWaiting(innerKind, ref);
      if (answer.status === 'pending') isWaiting = true;
      return answer;
    },
    readWithoutWaiting(innerKind, ref) {
      const answer = readAt(files, nestedReference(located, ref), innerKind, stack);
      reads.push({ kind: innerKind, ref, answer });
      return answer;
    },
    reference(ref) {
      handedTables = located.resources;
      return nestedReference(located, ref);
    },
    loaded(fileKind) {
      const { address } = located.held;
      if (address === null) return NONE;
      const answer = loadedAt(files, fileKind, address);
      reads.push({ fileKind: fileKind as FileKind<object>, address, answer });
      if (answer.status === 'pending') isWaiting = true;
      return answer;
    },
  };
  const value = decodeOnce(kind, located.held, follow);
  // Pending spreads upward: the value waits for the file a nested read named, and is not kept.
  if (isWaiting) return PENDING;
  const answer: Read<T> = value === null ? declined(reads) : { status: 'loaded', value };
  slots.set(slot, {
    properties: located.held.properties,
    isBuiltIn: located.held.address === null,
    reads,
    handedTables,
    answer,
  });
  return answer;
}

/**
 * The answer of a decode that declines: the failure of the holder's own file when the decode read it
 * whole, so a font file that failed reads as missing-file, else undecodable.
 */
function declined(reads: readonly FollowedRead[]): Read<never> {
  const ownFile = reads.find((read) => 'fileKind' in read && read.answer.status === 'unavailable');
  return (ownFile?.answer as Read<never> | undefined) ?? UNAVAILABLE.undecodable;
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
function stillHolds(kept: Decoded, located: Located, files: FileSource, stack: readonly string[]): boolean {
  const { held } = located;
  const sameProperties = kept.isBuiltIn
    ? sameData(kept.properties, held.properties)
    : kept.properties === held.properties;
  return (
    sameProperties &&
    (kept.handedTables === null || kept.handedTables === located.resources) &&
    kept.reads.every((read) => readAgain(files, located, read, stack) === read.answer)
  );
}

/** The answer `read` gets now, for a decode kept from an earlier snapshot. */
function readAgain(
  files: FileSource,
  located: Located,
  read: FollowedRead,
  stack: readonly string[]
): Read<unknown> {
  if ('fileKind' in read) return loadedAt(files, read.fileKind, read.address);
  return readAt(files, nestedReference(located, read.ref), read.kind, stack);
}
