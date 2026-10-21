/**
 * The element list between a `PackedInt32Array(…)`'s parentheses, read as `_parse_construct<int32_t>`
 * reads it (`variant_parser.cpp:552-592`, `:1428-1445`): numbers only, so a bool fails the load.
 */

import { parseGodotInt } from './intReader.js';

/**
 * Each element as the int32 Godot stores, or `null` for a body with an element the tokenizer cannot
 * read, which fails the load. An element no int32 holds (`inf`, `1e20`) is NaN: its stored value is
 * undefined, and each caller decides what it stands for.
 */
export function int32Elements(body: string): number[] | null {
  // `''.split(',')` yields `['']`, which would refuse a legal empty array.
  if (body.trim() === '') return [];
  const elements: number[] = [];
  for (const part of body.split(',')) {
    const stored = parseGodotInt(part);
    if (stored === null) return null;
    elements.push(stored);
  }
  return elements;
}
