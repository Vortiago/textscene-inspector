/**
 * The `location` of a diagnostic about a node or one of its properties, read from the strict
 * parse's line table. A rule reaches its subject through the tree, which carries no lines.
 * Column 1, since the whole line is the subject.
 */

import type { TscnInternalResource, TscnNode } from '../parser/types.js';
import type { Diagnostic, SourceLines } from './types.js';

type Location = NonNullable<Diagnostic['location']>;

/**
 * The heading of the section that built `owner`. `undefined`, never a guessed line, for an
 * owner the scan did not build: the diagnostic then stays one about the whole file.
 */
export function headingLocation(
  lines: SourceLines,
  owner: TscnNode | TscnInternalResource
): Location | undefined {
  const section = lines.get(owner);
  return section && { line: section.heading, column: 1 };
}

/**
 * The line `owner`'s section wrote `key` on, `key` as the bag stores it. `undefined` where the
 * section wrote no such key.
 */
export function propertyLocation(
  lines: SourceLines,
  owner: TscnNode | TscnInternalResource,
  key: string
): Location | undefined {
  const line = lines.get(owner)?.properties.get(key);
  return line === undefined ? undefined : { line, column: 1 };
}
