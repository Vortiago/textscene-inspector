/**
 * FreeType's hash table of numbers (`fthash.c`): open addressing that probes downward, doubling
 * once a third full. The auto-hinter walks one in bucket order, so its order decides which code
 * point a shared substitute gets.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 2000-2026 by Francesco Zappa Nardelli, David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

const INITIAL_SIZE = 241;

export interface HashNode {
  readonly key: number;
  data: number;
}

/** `hash_num_lookup`: the four bytes of the key, folded by 31. */
function hashOf(key: number): number {
  let hash = key & 0xff;
  hash = hash * 31 + ((key >>> 8) & 0xff);
  hash = hash * 31 + ((key >>> 16) & 0xff);
  return hash * 31 + ((key >>> 24) & 0xff);
}

export class FtNumberHash {
  private table: (HashNode | null)[] = new Array<HashNode | null>(INITIAL_SIZE).fill(null);
  private used = 0;

  /** `hash_bucket`: the bucket of `key`, or the empty one it would go in. */
  private bucket(key: number): number {
    const size = this.table.length;
    let index = hashOf(key) % size;
    while (this.table[index] && this.table[index]!.key !== key) index = index === 0 ? size - 1 : index - 1;
    return index;
  }

  node(key: number): HashNode | null {
    return this.table[this.bucket(key)] ?? null;
  }

  /** `ft_hash_num_insert`: sets the data of `key`, growing the table first when it is a third full. */
  insert(key: number, data: number): void {
    const index = this.bucket(key);
    const existing = this.table[index];
    if (existing) {
      existing.data = data;
      return;
    }
    this.table[index] = { key, data };
    if (this.used >= Math.trunc(this.table.length / 3)) this.rehash();
    this.used++;
  }

  private rehash(): void {
    const old = this.table;
    this.table = new Array<HashNode | null>(old.length * 2).fill(null);
    for (const node of old) if (node) this.table[this.bucket(node.key)] = node;
  }

  /** `ft_hash_num_iterator`: the nodes in bucket order. */
  *entries(): IterableIterator<HashNode> {
    for (const node of this.table) if (node) yield node;
  }
}
