/**
 * Where a `res://` path lives on a host: under the Godot project root, the nearest directory, from a file's own
 * upward, that holds `project.godot`. String paths alone, with no `node:path`, since the VS Code host runs in a web worker. Paths come
 * back with forward slashes, which every host's filesystem API accepts.
 */

const RES_SCHEME = 'res://';
const PROJECT_FILE = 'project.godot';

/** `path` with forward slashes and no trailing one, unless it is a filesystem root such as `/` or `c:/`. */
function forwardSlashes(path: string): string {
  const slashed = path.replace(/\\/g, '/');
  const trimmed = slashed.replace(/\/+$/, '');
  return trimmed === '' || /^[A-Za-z]:$/.test(trimmed) ? `${trimmed}/` : trimmed;
}

/**
 * `path` as two host paths compare: forward slashes, lowercased. Case-insensitive because the default Windows and
 * macOS filesystems are, and a watcher can report either spelling.
 */
export function comparablePath(path: string): string {
  return forwardSlashes(path).toLowerCase();
}

/** Whether `candidate` is `root` or under it. The separator is the boundary, so `/proj-other` is not under `/proj`. */
export function isWithinRoot(root: string, candidate: string): boolean {
  const rootKey = comparablePath(root);
  const candidateKey = comparablePath(candidate);
  if (candidateKey === rootKey) return true;
  const prefix = rootKey.endsWith('/') ? rootKey : `${rootKey}/`;
  return candidateKey.startsWith(prefix);
}

/** `relative` under `dir`, with one separator between them. */
function joinUnder(dir: string, relative: string): string {
  const root = forwardSlashes(dir);
  return root.endsWith('/') ? `${root}${relative}` : `${root}/${relative}`;
}

/** The directory holding `path`, or null for a filesystem root. */
function parentDir(path: string): string | null {
  const dir = forwardSlashes(path);
  if (dir.endsWith('/')) return null;
  return forwardSlashes(dir.slice(0, dir.lastIndexOf('/') + 1));
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

/** The host path of `resPath` under `projectRoot`, or null for a path that is not `res://` or that escapes the root. */
export function resolveResPath(projectRoot: string, resPath: string): string | null {
  if (!resPath.startsWith(RES_SCHEME)) return null;
  const relative = normalizeRelativePath(resPath.slice(RES_SCHEME.length));
  return relative === null ? null : joinUnder(projectRoot, relative);
}

/**
 * The nearest directory, from `startDir` upward, where `hasProjectFile` finds a `project.godot`, or null for none. The walk
 * ends after `stopDir`, or after `startDir` itself when it lies outside `stopDir`. A null `stopDir` walks to the
 * filesystem root.
 */
export async function findProjectRoot(
  startDir: string,
  stopDir: string | null,
  hasProjectFile: (dir: string) => Promise<boolean>
): Promise<string | null> {
  for (let dir: string | null = forwardSlashes(startDir); dir !== null; dir = parentDir(dir)) {
    if (await hasProjectFile(dir)) return dir;
    if (stopDir !== null && (!isWithinRoot(stopDir, dir) || comparablePath(dir) === comparablePath(stopDir))) {
      return null;
    }
  }
  return null;
}

/** The `project.godot` a directory holds, for a host's `hasProjectFile`. */
export function projectFileIn(dir: string): string {
  return joinUnder(dir, PROJECT_FILE);
}
