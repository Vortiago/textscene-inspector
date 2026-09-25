/**
 * What `add_bone` does with a `bones/<i>/name` write, modelled across the node because each answer
 * depends on the writes before it. `_set` reaches `add_bone` only while `which == bones.size()`
 * (skeleton_3d.cpp:85), and `name` has no arm below the index guard at :90, so a name for any other
 * slot is dropped. A refused bone (:605, :606) is never added, which shifts every later slot.
 */

import { indexedKeyRegex, literalText, toIntIndex } from '../../../godot/index.js';
import { unquoteString } from '../../../parser/utils.js';

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
  /** The bone slot the key addresses. */
  index: number;
  /** The slot `add_bone` would have filled: the live bone count. */
  expected: number;
  name: string;
  /** For a duplicate, the bone already carrying the name. */
  heldBy?: number;
}

/**
 * Every dropped `bones/<i>/name` write, in file order. A negative index (`INVALID_BONE_INDEX`) and
 * a name :605 refuses are skipped, since phase 1 reports both on the same key. Both still leave the
 * bone unadded, which `added` records.
 */
export function boneNameFindings(properties: Record<string, string>): BoneNameFinding[] {
  const findings: BoneNameFinding[] = [];
  const taken = new Map<string, number>();
  let added = 0;

  for (const [key, value] of Object.entries(properties)) {
    const match = BONE_NAME_KEY.exec(key);
    if (!match) continue;
    const index = toIntIndex(match[1]!);
    // NaN fails this too, and is phase 1's as well.
    if (!(index >= 0)) continue;
    const name = boneNameText(value);
    if (addBoneRefusal(name) !== null) continue;

    if (index !== added) {
      findings.push({ kind: 'order', key, index, expected: added, name });
      continue;
    }
    const heldBy = taken.get(name);
    if (heldBy !== undefined) {
      findings.push({ kind: 'duplicate', key, index, expected: added, name, heldBy });
      continue;
    }
    taken.set(name, index);
    added++;
  }

  return findings;
}
