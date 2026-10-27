/**
 * Prints the shared helpers of the core, one job a line, from the `@oneWay` tags in its source.
 * The list lives only here, so it never goes stale: pipe it to grep to find a helper for a job.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { oneWayEntries, renderOneWayList } from './oneWayTags.mjs';

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '../../packages/textscene-core/src');

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function taggedEntries() {
  return sourceFiles(SOURCE).flatMap((path) =>
    oneWayEntries(readFileSync(path, 'utf8'), relative(SOURCE, path).replaceAll('\\', '/'))
  );
}

process.stdout.write(renderOneWayList(taggedEntries()));
