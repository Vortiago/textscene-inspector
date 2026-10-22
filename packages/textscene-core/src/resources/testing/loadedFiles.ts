/** `LoadedFile` lookups for a test: a scene whose files none has loaded, and one with a record of them. */
import type { ParsedResource } from '../../parser/parsedResource';
import type { LoadedFile } from '../scopedResource';

export const NO_FILES: LoadedFile = () => undefined;

export const loadedFilesOf =
  (files: Readonly<Record<string, ParsedResource>>): LoadedFile =>
  (path) =>
    files[path];
