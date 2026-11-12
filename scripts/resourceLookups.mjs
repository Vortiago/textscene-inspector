/**
 * Finds the readers of `@textscene/core` that look a resource reference up by hand (ADR-0071). A
 * reader outside `resources/reading/` reads through `useNodeResource` or `ResourceSnapshot.read`,
 * so a reference resolves the same way from a scene and from a file.
 */

import { stripComments } from '../packages/textscene-dev-kit/src/commentSpans.ts';
import { isTestFile } from './sourceTree.mjs';

/** The lookups of a reference and the hops of the old layer, each banned as a name followed by `(`. */
const BANNED = [
  'findSubResource',
  'resolveSubResourceRef',
  'findSubResourceOfType',
  'parseResourceReference',
  'findExtResource',
  'resolveExtResourcePath',
  'useResourceResolution',
  'usePathResolution',
  'useSubOrExtResource',
  'resolveReference',
  'resolveReferencedResource',
  'referencedFilePath',
  'useLoadedFiles',
  'useCachedFiles',
];

const CALL = new RegExp(`(?<![\\w$.])(${BANNED.join('|')})\\s*\\(`, 'g');

/** The trees a reader of a resource lives in. */
const SCANNED = /^(nodes|r3f|resources)\//;

/** The linter checks one file with no loader, so it resolves a reference in that file's own tables. */
const LINTER = /(^|\/)(linter|linterParser|linterValidators|index\.linter)\.ts$|(^|\/)linter\//;

const READING = 'resources/reading/';

/** A quoted string on one line. A template literal is left in, so a call inside one still counts. */
const QUOTED = /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g;

/** The banned calls in `text`, with comments and quoted strings left out. */
function bannedCalls(text) {
  const code = stripComments(text).replace(QUOTED, "''");
  return [...code.matchAll(CALL)].map((match) => match[1]);
}

/**
 * The failures of the scan over `files`, path to text: a call outside the module, the layer
 * (a set of paths) and `unmoved`, a map of path to `{ calls, issue }`, and each entry of
 * `unmoved` that is stale or names no issue.
 */
export function lookupFailures(files, layer, unmoved) {
  const failures = [];
  for (const [path, text] of files) {
    if (isTestFile(path) || LINTER.test(path) || !SCANNED.test(path)) continue;
    if (path.startsWith(READING) || layer.has(path)) continue;
    failures.push(...fileFailures(path, bannedCalls(text), unmoved.get(path)));
  }
  for (const path of unmoved.keys()) {
    if (!files.has(path))
      failures.push(`${path} is listed as not moved, but there is no such file: remove its entry`);
  }
  return failures;
}

function fileFailures(path, calls, entry) {
  if (!entry) {
    return calls.map(
      (name) =>
        `${path} calls ${name}(). Read the resource with useNodeResource or ResourceSnapshot.read (resources/reading/).`
    );
  }
  const failures = [];
  if (!Number.isInteger(entry.issue)) failures.push(`${path} names no issue that removes its entry`);
  if (calls.length === 0) failures.push(`${path} calls no lookup: its entry is stale, remove it`);
  else if (calls.length > entry.calls) {
    failures.push(
      `${path} has ${calls.length} calls of ${[...new Set(calls)].join(', ')}, its entry allows ${entry.calls}. ` +
        'Read the resource with useNodeResource or ResourceSnapshot.read (resources/reading/).'
    );
  } else if (calls.length < entry.calls)
    failures.push(`${path} has fewer calls: lower its entry to ${calls.length}`);
  return failures;
}
