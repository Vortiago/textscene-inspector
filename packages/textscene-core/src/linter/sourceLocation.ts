import type { BuiltSection } from '../parser/types.js';
import type { Diagnostic, SourceLines } from './types.js';

type Location = NonNullable<Diagnostic['location']>;

/**
 * The heading of the section that built `owner`. `undefined`, never a guessed line, for an
 * owner the scan did not build: the diagnostic then stays one about the whole file.
 */
export function headingLocation(lines: SourceLines, owner: BuiltSection): Location | undefined {
  const section = lines.get(owner);
  return section && { line: section.heading, column: section.headingColumn };
}

/**
 * The line `owner`'s section wrote `key` on, `key` as the bag stores it. `undefined` where the
 * section wrote no such key.
 */
export function propertyLocation(lines: SourceLines, owner: BuiltSection, key: string): Location | undefined {
  const section = lines.get(owner);
  const line = section?.properties.get(key);
  return line === undefined ? undefined : { line, column: section!.propertyColumns.get(key)! };
}
