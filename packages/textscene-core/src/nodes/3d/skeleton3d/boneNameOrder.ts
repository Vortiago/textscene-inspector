/**
 * What `add_bone` does with a `bones/<i>/name` write, modelled across the node because each answer
 * depends on the writes before it. `_set` reaches `add_bone` only while `which == bones.size()`
 * (skeleton_3d.cpp:85), and `name` has no arm below the index guard at :90, so a name for any other
 * slot is dropped. A refused bone (:605, :606) is never added, which shifts every later slot.
 */

import { indexedKeyRegex, literalText, stringToInt } from '../../../godot/index.js';
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
export interface BoneNameFinding {
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

/**
 * Every dropped `bones/<i>/name` write, in file order. An unreachable slot (`INVALID_BONE_INDEX`)
 * and a name :605 refuses are skipped, since phase 1 reports both on the same key. Both still leave
 * the bone unadded, which `added` records.
 */
export function boneNameFindings(properties: Record<string, string>): BoneNameFinding[] {
  const findings: BoneNameFinding[] = [];
  const taken = new Map<string, number>();
  let added = 0;

  for (const [key, value] of Object.entries(properties)) {
    const match = BONE_NAME_KEY.exec(key);
    if (!match) continue;
    const indexText = match[1]!;
    const index = stringToInt(indexText, 'uint32');
    if (index >= UNREACHABLE_BONE_SLOT) continue;
    const name = boneNameText(value);
    if (addBoneRefusal(name) !== null) continue;

    if (index !== added) {
      findings.push({ kind: 'order', key, indexText, index, expected: added, name });
      continue;
    }
    const heldBy = taken.get(name);
    if (heldBy !== undefined) {
      findings.push({ kind: 'duplicate', key, indexText, index, expected: added, name, heldBy });
      continue;
    }
    taken.set(name, index);
    added++;
  }

  return findings;
}
