/**
 * Where a `res://` path lives on a host: under the Godot project root, the nearest directory, from a file's own
 * upward, that holds `project.godot`, or under the file's own directory when none does. No `node:path`, since the
 * VS Code host runs in a web worker. String paths come back with forward slashes, which every host's filesystem API
 * accepts.
 */

import { PROJECT_FILE_NAME } from '../godot/project.js';

export const RES_SCHEME = 'res://';

/**
 * `path` without its trailing slashes. A loop, not `/\/+$/`: that regex backtracks quadratically on a
 * path with many slashes that do not end it, and a host hands this any path it is given.
 */
function withoutTrailingSlashes(path: string): string {
  let end = path.length;
  while (end > 0 && path[end - 1] === '/') end--;
  return path.slice(0, end);
}

/** `path` with forward slashes and no trailing one, unless it is a filesystem root such as `/` or `c:/`. */
function forwardSlashes(path: string): string {
  const trimmed = withoutTrailingSlashes(path.replace(/\\/g, '/'));
  return trimmed === '' || /^[A-Za-z]:$/.test(trimmed) ? `${trimmed}/` : trimmed;
}

/**
 * `path` as two host paths compare: forward slashes, lowercased. Case-insensitive because the default Windows and
 * macOS filesystems are, and a watcher can report either spelling.
 */
export function comparablePath(path: string): string {
  return forwardSlashes(path).toLowerCase();
}

/** Whether a host's filesystem tells apart two spellings of a path that differ only in case. */
export type PathCase = 'sensitive' | 'insensitive';

/**
 * The path case of the default filesystem on `platform`, a Node `process.platform` value. Windows and macOS ignore
 * case. Any other platform, and an unknown one such as a web worker's, counts case: a refused path is safer than a
 * sibling outside the root.
 */
export function pathCaseOf(platform: string | undefined): PathCase {
  return platform === 'win32' || platform === 'darwin' ? 'insensitive' : 'sensitive';
}

/**
 * Whether `candidate` is `root` or under it. The separator is the boundary, so `/proj-other` is not under `/proj`.
 * Case counts unless `pathCase` is insensitive, so on Linux `/w/game` is not under `/w/Game`.
 */
export function isWithinRoot(root: string, candidate: string, pathCase: PathCase): boolean {
  const keyOf = pathCase === 'insensitive' ? comparablePath : forwardSlashes;
  const rootKey = keyOf(root);
  const candidateKey = keyOf(candidate);
  if (candidateKey === rootKey) return true;
  const prefix = rootKey.endsWith('/') ? rootKey : `${rootKey}/`;
  return candidateKey.startsWith(prefix);
}

/** `relative` under `dir`, with one separator between them. */
function joinUnder(dir: string, relative: string): string {
  const root = forwardSlashes(dir);
  return root.endsWith('/') ? `${root}${relative}` : `${root}/${relative}`;
}

/**
 * The directory holding `path`, or null for a filesystem root or a bare name: the top of an upward walk over string
 * paths, as `findProjectRoot`'s `parent`.
 */
export function parentDir(path: string): string | null {
  const dir = forwardSlashes(path);
  const lastSlash = dir.lastIndexOf('/');
  return dir.endsWith('/') || lastSlash < 0 ? null : forwardSlashes(dir.slice(0, lastSlash));
}

/**
 * `relative` with `.` and empty segments dropped and each `..` folded into its parent, or null when a `..` climbs
 * above where the path starts.
 */
export function normalizeRelativePath(relative: string): string | null {
  const segments: string[] = [];
  for (const segment of relative.replace(/\\/g, '/').split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment !== '..') segments.push(segment);
    else if (segments.pop() === undefined) return null;
  }
  return segments.join('/');
}

/**
 * `resPath` relative to its project root, or null for a path that is not `res://` or that escapes the root. For a host
 * whose paths are not strings, such as VS Code's `Uri`.
 */
export function resRelativePath(resPath: string): string | null {
  return resPath.startsWith(RES_SCHEME) ? normalizeRelativePath(resPath.slice(RES_SCHEME.length)) : null;
}

/** The host path of `resPath` under `projectRoot`, or null for a path that is not `res://` or that escapes the root. */
export function resolveResPath(projectRoot: string, resPath: string): string | null {
  const relative = resRelativePath(resPath);
  return relative === null ? null : joinUnder(projectRoot, relative);
}

/**
 * The nearest directory, from `start` upward through `parent`, where `hasProjectFile` finds a `project.godot`, or null
 * for none. The walk ends after the first directory `isStop` accepts, or at the top, where `parent` gives null. Generic
 * over the directory handle, so each host walks its own kind: a string path, or a `Uri` that keeps its scheme.
 */
export async function findProjectRoot<Dir>(
  start: Dir,
  parent: (dir: Dir) => Dir | null,
  isStop: (dir: Dir) => boolean,
  hasProjectFile: (dir: Dir) => Promise<boolean>
): Promise<Dir | null> {
  for (let dir: Dir | null = start; dir !== null; dir = parent(dir)) {
    if (await hasProjectFile(dir)) return dir;
    if (isStop(dir)) return null;
  }
  return null;
}

/**
 * The directory a scene's `res://` paths resolve under: its Godot project root, or `sceneDir` itself when no
 * directory holds `project.godot`. Godot has no `res://` outside a project, but a loose scene, such as one copied out
 * of a demo, names its files relative to its own directory. The VS Code extension, the `tscn-lsp` server and the
 * `tscn-lint` CLI take this one answer.
 */
export async function findResRoot<Dir>(
  sceneDir: Dir,
  parent: (dir: Dir) => Dir | null,
  isStop: (dir: Dir) => boolean,
  hasProjectFile: (dir: Dir) => Promise<boolean>
): Promise<Dir> {
  return (await findProjectRoot(sceneDir, parent, isStop, hasProjectFile)) ?? sceneDir;
}

/** The `project.godot` a directory holds, for a host's `hasProjectFile`. */
export function projectFileIn(dir: string): string {
  return joinUnder(dir, PROJECT_FILE_NAME);
}
