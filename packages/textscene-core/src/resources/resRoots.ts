/**
 * A scene's `res://` root for a host that reads a filesystem: the answer to "which directory do this scene's
 * `res://` paths resolve under", and the files and listings of that directory. The rule is Godot's, with one loose
 * fallback: the nearest `project.godot` above the scene, else the scene's own directory inside the workspace, else
 * none. The module owns every answer it reads, so a host asks it and calls {@link ResRoots.invalidate} when a file
 * changes. It imports no `node:` module: a host's adapter fills {@link ResRootsPort}.
 */

import { isScannedDirectoryName } from '../godot/project/editorScan.js';
import type { ResourceProvider } from './ResourceProvider.js';
import { listScannedFiles, type DirectoryEntry, type DirectoryReader } from './projectListing.js';
import {
  findResRoot,
  forwardSlashes,
  isSamePath,
  isWithinRoot,
  parentDir,
  projectFileIn,
  resolveResPath,
  type PathCase,
} from './resPath.js';
import { fileStamp, resourceContent } from './resourceProviderUtils.js';

/** What a host's `stat` reports of a file. */
export interface FileStat {
  readonly isFile: boolean;
  readonly mtimeMs: number;
  readonly size: number;
}

/**
 * The filesystem a host gives {@link createResRoots}. Every path is absolute with forward slashes, as `parentDir` and
 * `resolveResPath` spell it, and no method throws: an absent or unreadable path is the null or empty answer.
 */
export interface ResRootsPort {
  /** Whether the filesystem tells apart two spellings of a path that differ only in case. */
  readonly pathCase: PathCase;
  /** The file or directory at `path`, or null for none. */
  stat(path: string): Promise<FileStat | null>;
  /** The path of `directory` with every link resolved, or null for a directory it cannot enter. */
  realPath(directory: string): Promise<string | null>;
  /** The entries of `directory`, each link resolved to what it names, or none for a directory it cannot read. */
  list(directory: string): Promise<readonly DirectoryEntry[]>;
  /** The bytes of the file at `path`, or null for a file it cannot read. */
  read(path: string): Promise<Uint8Array | null>;
}

/**
 * A `res://` root: the directory a scene's `res://` paths resolve under, and the provider the linter reads the
 * project through. It returns null for a path outside the root or a file it does not hold.
 */
export interface ResRoot extends ResourceProvider {
  /** The file's modification time and size, one `stat`, so the linter reads an unchanged file once. */
  stamp(resPath: string): Promise<string | null>;
  /** The host path of the file `resPath` names, or null for a path outside the root or a file it does not hold. */
  resolve(resPath: string): Promise<string | null>;
  /** The host path `resPath` names, whether or not a file is there, or null for a path outside the root. No `stat`. */
  pathOf(resPath: string): string | null;
  /** The `res://` path of every file the editor's scan reaches under the root, in walk order, for path completion. */
  listPaths(): Promise<readonly string[]>;
  /** Overrides the provider's optional listing: a root always lists. */
  listFiles(extension: string): Promise<readonly string[]>;
}

/**
 * The roots of one host's scenes, and every answer read from the filesystem to find them.
 *
 * @oneWay `res://` roots
 */
export interface ResRoots {
  /** The root of the scene at the absolute `scene` path, or null for a scene in no project and outside the workspace. */
  rootOf(scene: string): Promise<ResRoot | null>;
  /** The project at or above the workspace, or null. A document with no file path takes it. No loose root fills in. */
  workspaceRoot(): Promise<ResRoot | null>;
  /**
   * Drops every answer a change at `changedPath` can affect, a created or deleted `project.godot` moving the root of
   * each scene below it, so the next request reads the filesystem again.
   */
  invalidate(changedPath: string): void;
  /** Drops every answer, for a host that learns of no change. */
  invalidateAll(): void;
}

/** `map`'s value for `key`, made by `make` and kept the first time `key` is asked for. */
function memo<V>(map: Map<string, V>, key: string, make: (key: string) => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = make(key);
    map.set(key, value);
  }
  return value;
}

/**
 * A reader of the directories under `root`, for {@link listScannedFiles}. A directory whose real path it has read
 * before, reached again through a link, reads as empty, so a link up the tree ends the walk. It adds to
 * `linkedDirectories` the real path of each directory it reads outside the root, which only a link leads to.
 */
function directoryReader(port: ResRootsPort, root: string, linkedDirectories: Set<string>): DirectoryReader {
  const readRealPaths = new Set<string>();
  let rootRealPath: string | null = null;
  return async (resDirectory) => {
    const resolved = resolveResPath(root, resDirectory);
    if (resolved === null) return [];
    // `res://` itself resolves to the root with a trailing slash, which a port's directory has none.
    const directory = forwardSlashes(resolved);
    const real = await port.realPath(directory);
    // The scan skips a directory it cannot enter (`editor_file_system.cpp:1201-1202`).
    if (real === null || readRealPaths.has(real)) return [];
    readRealPaths.add(real);
    rootRealPath ??= real;
    if (!isWithinRoot(rootRealPath, real, port.pathCase)) linkedDirectories.add(real);
    return port.list(directory);
  };
}

/** One root, the directories outside it that its listings walked, and the call that drops those listings. */
interface RootEntry {
  /** The root's directory, with forward slashes. */
  readonly path: string;
  readonly root: ResRoot;
  readonly linkedDirectories: ReadonlySet<string>;
  forgetListings(): void;
}

/** The key of the listing of every file, which {@link listScannedFiles} gives for no extension. */
const EVERY_FILE = '';

/** A root over `path`, read through `port`. */
function createRoot(port: ResRootsPort, path: string): RootEntry {
  /** Each listing under its key: written by `listing` and cleared by `forgetListings`. */
  const listings = new Map<string, Promise<readonly string[]>>();
  /** Written by the walks of `listings`, and cleared with them. */
  const linkedDirectories = new Set<string>();
  const listing = (key: string, extension?: string) =>
    memo(listings, key, () => listScannedFiles(directoryReader(port, path, linkedDirectories), extension));
  const root: ResRoot = {
    async loadResource(resPath, type = '') {
      const file = resolveResPath(path, resPath);
      const bytes = file === null ? null : await port.read(file);
      return bytes === null ? null : resourceContent(bytes, type, resPath);
    },
    async stamp(resPath) {
      const file = resolveResPath(path, resPath);
      const stat = file === null ? null : await port.stat(file);
      return stat === null ? null : fileStamp(stat.mtimeMs, stat.size);
    },
    pathOf: (resPath) => resolveResPath(path, resPath),
    async resolve(resPath) {
      const file = resolveResPath(path, resPath);
      return file !== null && (await port.stat(file))?.isFile === true ? file : null;
    },
    listFiles(extension) {
      const lowered = extension.toLowerCase();
      // A dot in the key keeps an extension apart from EVERY_FILE.
      return listing(`.${lowered}`, lowered);
    },
    listPaths: () => listing(EVERY_FILE),
  };
  return {
    path,
    root,
    linkedDirectories,
    forgetListings() {
      listings.clear();
      linkedDirectories.clear();
    },
  };
}

class PortResRoots implements ResRoots {
  /** The workspace directory, spelled as the walk spells it. */
  private readonly workspaceDir: string | null;
  /** Each directory's answer, written by `hasProjectFile`: the scenes of one run share their ancestors. */
  private readonly hasProjectFileByDir = new Map<string, Promise<boolean>>();
  /** Each root by its real path, written by `rootAt`. Two spellings of a directory share one, and what it keeps. */
  private readonly rootByRealPath = new Map<string, RootEntry>();
  /** Each directory spelling's root, written by `rootAt`, so a spelling costs one `realPath`. */
  private readonly rootBySpelling = new Map<string, Promise<RootEntry>>();

  constructor(
    private readonly port: ResRootsPort,
    workspace: string | null
  ) {
    this.workspaceDir = workspace === null ? null : forwardSlashes(workspace);
  }

  async rootOf(scene: string): Promise<ResRoot | null> {
    const sceneDir = parentDir(scene);
    if (sceneDir === null) return null;
    const isInWorkspace = (dir: string) =>
      this.workspaceDir !== null && isWithinRoot(this.workspaceDir, dir, this.port.pathCase);
    return this.rootFrom(sceneDir, isInWorkspace);
  }

  workspaceRoot(): Promise<ResRoot | null> {
    return this.workspaceDir === null ? Promise.resolve(null) : this.rootFrom(this.workspaceDir, () => false);
  }

  invalidate(changedPath: string): void {
    const affected = this.directoryAffectedBy(changedPath);
    this.dropWithin(this.hasProjectFileByDir, affected);
    this.dropWithin(this.rootBySpelling, affected);
    for (const [realPath, entry] of this.rootByRealPath) {
      // A watcher may spell the change through either name of the root, or inside a directory a link leads to.
      const directories = [entry.path, realPath, ...entry.linkedDirectories];
      if (directories.some((directory) => this.changesListing(directory, changedPath))) {
        entry.forgetListings();
      }
    }
  }

  invalidateAll(): void {
    this.hasProjectFileByDir.clear();
    this.rootBySpelling.clear();
    for (const { forgetListings } of this.rootByRealPath.values()) forgetListings();
  }

  /** The root found from `start` upward, where `isLoose` says whether a directory may serve as a loose root. */
  private async rootFrom(start: string, isLoose: (dir: string) => boolean): Promise<ResRoot | null> {
    const rootDir = await findResRoot(start, parentDir, this.hasProjectFile, isLoose);
    return rootDir === null ? null : this.rootAt(rootDir);
  }

  private async rootAt(dir: string): Promise<ResRoot> {
    const entry = await memo(this.rootBySpelling, dir, async () => {
      const realPath = (await this.port.realPath(dir)) ?? dir;
      return memo(this.rootByRealPath, realPath, () => createRoot(this.port, dir));
    });
    return entry.root;
  }

  /** Whether a change at `changedPath` can edit the listing of the root at `rootDir`. */
  private changesListing(rootDir: string, changedPath: string): boolean {
    const { pathCase } = this.port;
    // A removed directory above the root empties it.
    if (isWithinRoot(changedPath, rootDir, pathCase)) return true;
    if (!isWithinRoot(rootDir, changedPath, pathCase)) return false;
    // The scan never enters a dot-named directory, so a change under `.git` or `.godot` edits no listing.
    const relative = forwardSlashes(changedPath).slice(forwardSlashes(rootDir).length).replace(/^\//, '');
    return relative.split('/').slice(0, -1).every(isScannedDirectoryName);
  }

  /** Deletes each answer of `answers`, keyed by a directory, that lies at or under `directory`. */
  private dropWithin(answers: Map<string, unknown>, directory: string): void {
    for (const key of answers.keys()) {
      if (isWithinRoot(directory, key, this.port.pathCase)) answers.delete(key);
    }
  }

  private readonly hasProjectFile = (dir: string): Promise<boolean> =>
    memo(
      this.hasProjectFileByDir,
      dir,
      async () => (await this.port.stat(projectFileIn(dir)))?.isFile === true
    );

  /** The directory whose roots a change at `changedPath` can move: the one a `project.godot` heads, else the path. */
  private directoryAffectedBy(changedPath: string): string {
    const dir = parentDir(changedPath);
    return dir !== null && isSamePath(changedPath, projectFileIn(dir), this.port.pathCase)
      ? dir
      : changedPath;
  }
}

/** The roots of the scenes in `workspace`, a directory, or of any scene when it is null, read through `port`. */
export function createResRoots(port: ResRootsPort, workspace: string | null): ResRoots {
  return new PortResRoots(port, workspace);
}
