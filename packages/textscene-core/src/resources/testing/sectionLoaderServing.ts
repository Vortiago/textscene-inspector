/**
 * A `SectionLoaderFn` over `.tres` texts keyed by file path, parsed on each read as the
 * `resource` slot would parse them once. A path outside `files` rejects as missing.
 * Test-only, like the rest of `testing/`, and it never imports `vitest`.
 */
import { parseTresFile } from '../../parser/parsedResource';
import { sectionLoader, type SectionLoaderFn } from '../resourceSection';
import { resourceFilePath } from '../subResourcePath';

export function sectionLoaderServing(files: Record<string, string>): SectionLoaderFn {
  return sectionLoader(async (path) => {
    const filePath = resourceFilePath(path);
    const text = files[filePath];
    if (text === undefined) throw new Error(`File not found: ${filePath}`);
    return parseTresFile(text);
  });
}
