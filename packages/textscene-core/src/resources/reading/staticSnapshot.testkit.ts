/**
 * A snapshot over a fixed map of path to file text, with no loader: the second adapter of the
 * inner seam, for a pure decode test. A path the map does not hold, or a file that does not parse,
 * answers as a failed file.
 */

import { parseShaderFile, parseTresFile, type ParsedResource } from '../../parser/parsedResource';
import { GODOT_SHADER_EXTENSION } from '../../godot/project/resourceFormats';
import { fileExtension } from '../fileExtension';
import type { ResourceSnapshot } from './read';
import { snapshotOver } from './snapshot';

export function staticSnapshot(files: Readonly<Record<string, string>>): ResourceSnapshot {
  /** Written only by `getCached`: each file parses once, so a snapshot answers a path with one object. */
  const parsed = new Map<string, ParsedResource | null>();
  return snapshotOver({
    getCached: (path) => {
      if (!parsed.has(path)) parsed.set(path, parseFile(path, files[path]));
      return parsed.get(path);
    },
  });
}

function parseFile(path: string, text: string | undefined): ParsedResource | null {
  if (text === undefined) return null;
  if (fileExtension(path) === GODOT_SHADER_EXTENSION) return parseShaderFile(text);
  try {
    return parseTresFile(text);
  } catch {
    // The loader fails a file that does not parse, and this map answers it the same way.
    return null;
  }
}
