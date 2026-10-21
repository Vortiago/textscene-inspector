/**
 * A scene's `res://` root for a host that reads a filesystem: the answer to "which directory do this scene's
 * `res://` paths resolve under", and the files and listings of that directory. The rule is Godot's, with one loose
 * fallback: the nearest `project.godot` above the scene, else the scene's own directory inside the workspace, else
 * none. The module owns every answer it reads, so a host asks it and calls {@link ResRoots.invalidate} when a file
 * changes. It imports no `node:` module: a host's adapter fills {@link ResRootsPort}.
 */

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
import { resourceContent } from './resourceProviderUtils.js';

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
  /**
   * The highest directory the walk for a `project.godot` checks, or null for the top of the filesystem. A scene
   * outside it is checked in its own directory alone. A Node host's watchers see past the workspace, so its bound is
   * the top.
   */
  readonly walkBound: string | null;
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
  /** The root's directory, with forward slashes. */
  readonly path: string;
  /** The file's modification time and size, one `stat`, so the linter reads an unchanged file once. */
  stamp(resPath: string): Promise<string | null>;
  /** The host path of the file `resPath` names, or null for a path outside the root or a file it does not hold. */
  resolve(resPath: string): Promise<string | null>;
  /** The `res://` path of every file the editor's scan reaches under the root, sorted, for path completion. */
  listPaths(): Promise<readonly string[]>;
  /** Overrides the provider's optional listing: a root always lists. */
  listFiles(extension: string): Promise<string[]>;
}

/** The roots of one host's scenes, and every answer read from the filesystem to find them. */
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
 * before, reached again through a link, reads as empty, so a link up the tree ends the walk.
 */
function directoryReader(port: ResRootsPort, root: string): DirectoryReader {
  const readRealPaths = new Set<string>();
  return async (resDirectory) => {
    const resolved = resolveResPath(root, resDirectory);
    // `res://` itself resolves to the root with a trailing slash, which a port's directory has none.
    const directory = resolved === null ? null : forwardSlashes(resolved);
    const real = directory === null ? null : await port.realPath(directory);
    // The scan skips a directory it cannot enter (`editor_file_system.cpp:1201-1202`).
    if (directory === null || real === null || readRealPaths.has(real)) return [];
    readRealPaths.add(real);
    return port.list(directory);
  };
}

/** A root over `path`, read through `port`, and the call that drops its listings. */
function createRoot(port: ResRootsPort, path: string): { root: ResRoot; forgetListings: () => void } {
  /** Each extension's listing, written by `listFiles` and cleared by `forgetListings`. */
  const listingByExtension = new Map<string, Promise<string[]>>();
  /** The listing of every file, written by `listPaths` and cleared by `forgetListings`. */
  let allPaths: Promise<readonly string[]> | null = null;
  const root: ResRoot = {
    path,
    async loadResource(resPath, type = '') {
      const file = resolveResPath(path, resPath);
      const bytes = file === null ? null : await port.read(file);
      return bytes === null ? null : resourceContent(bytes, type, resPath);
    },
    async stamp(resPath) {
      const file = resolveResPath(path, resPath);
      const stat = file === null ? null : await port.stat(file);
      return stat === null ? null : `${stat.mtimeMs}:${stat.size}`;
    },
    async resolve(resPath) {
      const file = resolveResPath(path, resPath);
      return file !== null && (await port.stat(file))?.isFile === true ? file : null;
    },
    listFiles(extension) {
      return memo(listingByExtension, extension.toLowerCase(), (key) =>
        listScannedFiles(directoryReader(port, path), key)
      );
    },
    listPaths() {
      allPaths ??= listScannedFiles(directoryReader(port, path)).then((paths) => paths.sort());
      return allPaths;
    },
  };
  return {
    root,
    forgetListings() {
      listingByExtension.clear();
      allPaths = null;
    },
  };
}

class PortResRoots implements ResRoots {
  /** The workspace directory, spelled as the walk spells it. */
  private readonly workspaceDir: string | null;
  /** Each directory's answer, written by `hasProjectFile`: the scenes of one run share their ancestors. */
  private readonly hasProjectFileByDir = new Map<string, Promise<boolean>>();
  /** Each scene directory's root directory, written by `rootOf`. */
  private readonly rootDirByDir = new Map<string, Promise<string | null>>();
  /** Each root by its directory, written by `rootAt`. One per directory, so what a root keeps serves every scene. */
  private readonly rootByDir = new Map<string, ReturnType<typeof createRoot>>();

  constructor(
    private readonly port: ResRootsPort,
    workspace: string | null
  ) {
    this.workspaceDir = workspace === null ? null : forwardSlashes(workspace);
  }

  async rootOf(scene: string): Promise<ResRoot | null> {
    const sceneDir = parentDir(scene);
    if (sceneDir === null) return null;
    const rootDir = await memo(this.rootDirByDir, sceneDir, () =>
      findResRoot(
        sceneDir,
        parentDir,
        this.isWalkEnd,
        this.hasProjectFile,
        (dir) => this.workspaceDir !== null && isWithinRoot(this.workspaceDir, dir, this.port.pathCase)
      )
    );
    return rootDir === null ? null : this.rootAt(rootDir);
  }

  async workspaceRoot(): Promise<ResRoot | null> {
    if (this.workspaceDir === null) return null;
    const rootDir = await findResRoot(
      this.workspaceDir,
      parentDir,
      this.isWalkEnd,
      this.hasProjectFile,
      () => false
    );
    return rootDir === null ? null : this.rootAt(rootDir);
  }

  invalidate(changedPath: string): void {
    const affected = this.directoryAffectedBy(changedPath);
    for (const answers of [this.hasProjectFileByDir, this.rootDirByDir]) {
      for (const dir of answers.keys()) {
        if (isWithinRoot(affected, dir, this.port.pathCase)) answers.delete(dir);
      }
    }
    for (const [rootDir, { forgetListings }] of this.rootByDir) {
      // Either way round: a file under the root edits its listing, and a removed directory above it empties it.
      const { pathCase } = this.port;
      if (isWithinRoot(rootDir, changedPath, pathCase) || isWithinRoot(changedPath, rootDir, pathCase)) {
        forgetListings();
      }
    }
  }

  invalidateAll(): void {
    this.hasProjectFileByDir.clear();
    this.rootDirByDir.clear();
    for (const { forgetListings } of this.rootByDir.values()) forgetListings();
  }

  private rootAt(dir: string): ResRoot {
    return memo(this.rootByDir, dir, () => createRoot(this.port, dir)).root;
  }

  private readonly hasProjectFile = (dir: string): Promise<boolean> =>
    memo(
      this.hasProjectFileByDir,
      dir,
      async () => (await this.port.stat(projectFileIn(dir)))?.isFile === true
    );

  /** Whether the walk ends at `dir`: the bound itself, or a directory outside it. */
  private readonly isWalkEnd = (dir: string): boolean => {
    const { walkBound, pathCase } = this.port;
    return (
      walkBound !== null && (isSamePath(dir, walkBound, pathCase) || !isWithinRoot(walkBound, dir, pathCase))
    );
  };

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
