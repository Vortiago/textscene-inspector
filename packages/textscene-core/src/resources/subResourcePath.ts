/**
 * The **Sub-resource path** grammar — `res://file.tres::SubId`.
 *
 * Godot's own notation for a resource that lives *inside* another resource
 * file: its text saver writes `<file>::<id>` as the path of every
 * `[sub_resource]`, and `ResourceLoader.load()` accepts that form. Adopting it
 * here means one string type addresses all three kinds of reference a slot can
 * carry — an `ExtResource` `.tres`, a `SubResource` of the previewed scene, and
 * a `SubResource` of some other `.tres` — so a consumer holding a resource path
 * never learns that the third kind is a category.
 *
 * The whole address is the cache key (processor caches, in-flight dedupe,
 * `useResource`'s LRU pin), while `filePath` is the only thing a
 * `ResourceProvider` or the `FileEventBus` ever sees: the bytes of a
 * sub-resource ARE the bytes of the file that owns it, and only real files can
 * be fetched, hot-reloaded, or fulfilled by a **Resource upload**.
 *
 * A `res://` path cannot contain a colon (Godot rejects it, and it is an
 * invalid Windows filename), so the separator is unambiguous and a plain path
 * round-trips untouched.
 */

import type { TscnInternalResource } from '../parser/types.js';
import { findSubResource, parseResourceReference } from './SubResourceResolver.js';

/** What Godot's text saver writes between an owning file and one of its sub-resources. */
const SEPARATOR = '::';

export interface SubResourceAddress {
  /** The `res://` file that owns the resource — always fetchable as-is. */
  filePath: string;
  /**
   * The `[sub_resource id="…"]` to read inside that file. Undefined when the
   * path addresses the file's own `[resource]` body.
   */
  subResourceId?: string;
}

/**
 * Split a resource path into the file to fetch and the sub-resource to read out
 * of it. A plain path yields just `filePath`, so callers can apply this
 * unconditionally.
 */
export function parseSubResourcePath(path: string): SubResourceAddress {
  const at = path.indexOf(SEPARATOR);
  if (at < 0) return { filePath: path };
  const subResourceId = path.slice(at + SEPARATOR.length);
  // A trailing separator with nothing after it names no sub-resource; treat it
  // as the file itself rather than inventing an empty id no lookup can match.
  if (subResourceId === '') return { filePath: path.slice(0, at) };
  return { filePath: path.slice(0, at), subResourceId };
}

/** Address the `[sub_resource id="subResourceId"]` declared inside `filePath`. */
export function subResourcePath(filePath: string, subResourceId: string): string {
  return `${filePath}${SEPARATOR}${subResourceId}`;
}

/** The fetchable file behind either form of path — what the byte layer is asked for. */
export function resourceFilePath(path: string): string {
  return parseSubResourcePath(path).filePath;
}

/**
 * A resource reference written inside a `.tres` as the one path string that
 * addresses it, whichever form Godot used: an `ExtResource` pointing at a shared
 * file, or a `SubResource` the file carries itself — the latter as a
 * **Sub-resource path** into `selfPath`. Null when the reference is absent,
 * malformed, or an `ExtResource` id the file never declared.
 *
 * Every producer of an address goes through here so the
 * ExtResource-vs-SubResource policy is written once. Transcribing it per producer
 * is how two of them come to disagree — on interior whitespace, on a future
 * `uid://` form, on which branch wins.
 */
export function resolveRefToResourcePath(
  ref: string | undefined,
  extPathById: ReadonlyMap<string, string>,
  selfPath: string,
  gate?: SubResourceGate
): string | null {
  if (!ref) return null;
  const parsed = parseResourceReference(ref);
  if (!parsed) return null;
  if (parsed.type === 'ExtResource') return extPathById.get(parsed.id) ?? null;
  if (gate && !gate.accepts(findSubResource(gate.declared, parsed.id))) return null;
  return subResourcePath(selfPath, parsed.id);
}

/**
 * Optional gate on the SubResource branch: an address is only worth minting when
 * whatever loads it can build the thing at the other end.
 *
 * Minting one regardless is not harmless optimism — the load fails, the failure is
 * cached, and the user gets a permanent missing-resources row for a file that is
 * present and correct. Every producer needs that judgement, so it lives beside the
 * minting instead of being transcribed next to each caller.
 */
export interface SubResourceGate {
  /** The declaring document's `[sub_resource]`s. */
  declared: readonly TscnInternalResource[];
  /** `undefined` means the id names nothing declared. */
  accepts: (sub: TscnInternalResource | undefined) => boolean;
}

/** Accept only sub-resources whose `type` is one of `types`. */
export function subResourceTypeGate(
  declared: readonly TscnInternalResource[],
  types: ReadonlySet<string>
): SubResourceGate {
  return { declared, accepts: (sub) => sub !== undefined && types.has(sub.type) };
}

/** Accept nothing: a document whose sub-resources no resource path can address. */
export const REJECT_SUB_RESOURCES: SubResourceGate = { declared: [], accepts: () => false };
