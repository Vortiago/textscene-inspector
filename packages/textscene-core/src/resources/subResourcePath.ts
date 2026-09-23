/**
 * The **Sub-resource path** grammar, `res://file.tres::SubId`: Godot's text saver
 * writes it for every `[sub_resource]`, and `ResourceLoader.load()` accepts it.
 * One string addresses an `ExtResource` `.tres`, a `SubResource` of the scene,
 * and a `SubResource` of another `.tres`.
 */

import { warn } from '../logger.js';
import type { TscnInternalResource } from '../parser/types.js';
import { findSubResource, parseResourceReference } from './SubResourceResolver.js';

/**
 * What Godot's text saver writes between an owning file and a sub-resource. A
 * `res://` path cannot contain a colon (Godot rejects it, and Windows forbids
 * it), so the separator is unambiguous.
 */
const SEPARATOR = '::';

export interface SubResourceAddress {
  /**
   * The `res://` file that owns the resource, always fetchable as-is. The whole
   * address is the cache key. Only `filePath` reaches a `ResourceProvider` or the
   * `FileEventBus`, since only a real file is fetched, hot-reloaded or uploaded.
   */
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

/** The fetchable file behind either form of path: what the byte layer is asked for. */
export function resourceFilePath(path: string): string {
  return parseSubResourcePath(path).filePath;
}

/**
 * A reference inside a `.tres` as one path string: an `ExtResource` file, or a
 * `SubResource` as a **Sub-resource path** into `selfPath`. Null when the
 * reference is absent, malformed, or an undeclared `ExtResource` id. Every
 * producer of an address calls this, so the policy is written once.
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
  if (gate) {
    const sub = findSubResource(gate.declared, parsed.id);
    // An undeclared id is a broken file, not a declined type. Say so, or the
    // `.tres` renders a default and nothing names the dangling id.
    if (!sub && gate.declared.length > 0) {
      warn(`[SubResource] "${parsed.id}" is referenced but not declared — ignoring it`);
    }
    if (!gate.accepts(sub)) return null;
  }
  return subResourcePath(selfPath, parsed.id);
}

/**
 * Optional gate on the SubResource branch: mint an address only when its loader
 * can build the thing. Otherwise the failed load is cached, and a present, correct
 * file gets a permanent missing-resources row.
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
