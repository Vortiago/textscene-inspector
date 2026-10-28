/**
 * What `add_bone` does with a `bones/<i>/name` write, modelled across the node because each answer
 * depends on the writes before it. `_set` reaches `add_bone` only while `which == bones.size()`
 * (skeleton_3d.cpp:85), and `name` has no arm below the index guard at :90, so a name for any other
 * slot is dropped. A refused bone (:605, :606) is never added, which shifts every later slot.
 */
import { firstSegment, indexedKeyRegex } from '../../../godot/classdb/indexedKey.js';
import { literalText, stringToInt } from '../../../godot/string/string.js';
import { unquoteString } from '../../../parser/utils.js';

/**
 * The lowest bone slot no file reaches. `bones` grows by one bone per `bones/<size>/name` key
 * (:85), so slot 2^31 needs 2^31 name keys before it. A key that addresses it or above is refused
 * by `ERR_FAIL_UNSIGNED_INDEX_V(which, bones.size(), false)` (:90), which phase 1 reports.
 */
export const UNREACHABLE_BONE_SLOT = 2 ** 31;

/**
 * `bones/<i>/name`, plus anything below it: `_set` dispatches on slice 2 alone
 * (:83), so `bones/0/name/x` reaches the same arm.
 */
const BONE_NAME_KEY = indexedKeyRegex('^bones/(#)/name(?:/.*)?$', 'to_int');

/**
 * `bones/<idx>/<sub>`: the index is a bare `path.get_slicec('/', 1).to_int()` with no validity gate
 * (skeleton_3d.cpp:82), so `bones/x/position` names bone 0, and Godot applies it. Read the index
 * with `stringToInt(…, 'uint32')`, which `uint32_t which` stores.
 */
const BONE_KEY_RE = indexedKeyRegex('^bones/(#)/(.+)$', 'to_int');

/** A `bones/<idx>/<sub>` key as `_set` reads it. */
export interface BoneKey {
  /** The index as the file writes it. */
  readonly indexText: string;
  /** The slot the index names, as `uint32_t which` stores it. */
  readonly which: number;
  /** Slice 2, which alone decides the arm (:83): `bones/0/position/x` reaches `position`. */
  readonly leaf: string;
}

/**
 * The bone slot and leaf `key` writes, or null for a key that is no bone key.
 *
 * @canonical The bone slot and leaf of a Skeleton3D `bones/` key
 */
export function boneKeyOf(key: string): BoneKey | null {
  const match = BONE_KEY_RE.exec(key);
  if (!match) return null;
  const indexText = match[1]!;
  return { indexText, which: stringToInt(indexText, 'uint32'), leaf: firstSegment(match[2]!) };
}

/**
 * The String `add_bone` receives. Quotes and a `&`/`^` prefix come off, then
 * the escapes the tokenizer resolves before any setter runs, so `"a:b"`
 * is the two-character name with a colon in it that Godot refuses.
 */
export function boneNameText(value: string): string {
  return unquoteString(literalText(value));
}

/** The character `add_bone` refuses the name for, or null. */
export function addBoneRefusal(text: string): '' | ':' | '/' | null {
  if (text === '') return '';
  if (text.includes(':')) return ':';
  if (text.includes('/')) return '/';
  return null;
}

/** A `bones/<i>/name` write Godot drops, and why. */
interface BoneNameFinding {
  kind: 'order' | 'duplicate';
  key: string;
  /** The bone slot the key addresses, as the key writes it. */
  indexText: string;
  /** The slot Godot stores: `to_int()` in a `uint32_t which` (skeleton_3d.cpp:82). */
  index: number;
  /** The slot `add_bone` would have filled: the live bone count. */
  expected: number;
  name: string;
  /** For a duplicate, the bone already carrying the name. */
  heldBy?: number;
}

/** What one `bones/<i>/name` write did: added a bone, left none, or was dropped. */
type BoneAddition = { kind: 'added'; name: string } | { kind: 'refused' } | BoneNameFinding;

/**
 * The bone count and names that decide each `bones/<i>/name` write, in file order. The linter reads
 * what it drops, and the bone table reads what it adds, so the two cannot disagree.
 */
export class BoneAdder {
  private readonly taken = new Map<string, number>();
  private added = 0;

  /**
   * Null for a key that is no `bones/<i>/name`. An unreachable slot (`INVALID_BONE_INDEX`) and a name
   * :605 refuses are `refused`, since phase 1 reports both on the same key. Both leave the bone
   * unadded.
   */
  write(key: string, value: string): BoneAddition | null {
    const match = BONE_NAME_KEY.exec(key);
    if (!match) return null;
    const indexText = match[1]!;
    const index = stringToInt(indexText, 'uint32');
    if (index >= UNREACHABLE_BONE_SLOT) return { kind: 'refused' };
    const name = boneNameText(value);
    if (addBoneRefusal(name) !== null) return { kind: 'refused' };

    if (index !== this.added) {
      return { kind: 'order', key, indexText, index, expected: this.added, name };
    }
    const heldBy = this.taken.get(name);
    if (heldBy !== undefined) {
      return { kind: 'duplicate', key, indexText, index, expected: this.added, name, heldBy };
    }
    this.taken.set(name, index);
    this.added++;
    return { kind: 'added', name };
  }
}

/** Every dropped `bones/<i>/name` write, in file order. */
export function boneNameFindings(properties: Record<string, string>): BoneNameFinding[] {
  const findings: BoneNameFinding[] = [];
  const adder = new BoneAdder();
  for (const [key, value] of Object.entries(properties)) {
    const addition = adder.write(key, value);
    if (addition && (addition.kind === 'order' || addition.kind === 'duplicate')) findings.push(addition);
  }
  return findings;
}
