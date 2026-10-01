/**
 * The lints of one document over time, as a host shows them: the file's own diagnostics at once, beside the cross-file
 * ones of the last read, and the full list once the files it uses are read. It keeps what a host would otherwise keep
 * per document: the last cross-file diagnostics, which lint is newest, and the paths the newest one read.
 */

import type { ResourceProvider } from '../resources/ResourceProvider.js';
import { mergeDiagnostics } from './mergeDiagnostics.js';
import type { Diagnostic } from './types.js';

/** One used glTF `[ext_resource]` of a parse: the file it names, and where its heading sits. */
export interface GltfUse {
  readonly path: string;
  readonly location: Diagnostic['location'];
}

/** What `Linter` hands a session for one lint. */
export interface ProjectLint {
  /** The file's own diagnostics, unsorted. */
  readonly local: Diagnostic[];
  /** Each used glTF `[ext_resource]`, by id. */
  readonly gltfUses: ReadonlyMap<string, GltfUse>;
  /** The cross-file diagnostics, unsorted, or null when the file uses nothing a cross-file rule reads. */
  readonly crossFile: Promise<Diagnostic[]> | null;
  /** Every `res://` path the cross-file rules read, or may read, for this lint. */
  readonly reads: readonly string[];
}

/** One lint as a host publishes it. */
export interface SessionLint {
  /** The file's own diagnostics beside the kept cross-file ones, sorted errors first. Publish it at once. */
  readonly now: Diagnostic[];
  /**
   * The full list, sorted, once the cross-file rules have read their files. It resolves to null when a newer `lint`
   * of the session has overtaken this one. Null when the lint has no provider or the file uses nothing a cross-file
   * rule reads: `now` is final.
   */
  readonly later: Promise<Diagnostic[] | null> | null;
}

/** The cross-file diagnostics of the last read, and the glTF uses of the parse they were read for. */
interface Kept {
  readonly diagnostics: readonly Diagnostic[];
  readonly gltfUses: ReadonlyMap<string, GltfUse>;
}

const NOTHING_KEPT: Kept = { diagnostics: [], gltfUses: new Map() };

/**
 * `kept` moved onto the headings of `current`. A diagnostic about an `[ext_resource]` (its `nodeName` is the id) goes
 * to that id's heading in the new parse, or is dropped where the id is gone or now names another file. One about the
 * whole file stays as it was.
 */
function reanchored(kept: Kept, current: ReadonlyMap<string, GltfUse>): Diagnostic[] {
  const moved: Diagnostic[] = [];
  for (const diagnostic of kept.diagnostics) {
    const before = kept.gltfUses.get(diagnostic.nodeName);
    if (before === undefined) {
      moved.push(diagnostic);
      continue;
    }
    const now = current.get(diagnostic.nodeName);
    if (now === undefined || now.path !== before.path) continue;
    moved.push({ ...diagnostic, location: now.location });
  }
  return moved;
}

export class LintSession {
  /** Written when a newest lint's read lands, and cleared by a lint that reads nothing. */
  private kept: Kept = NOTHING_KEPT;
  /** The newest lint, written by `lint`, so an overtaken read never lands. */
  private newest: symbol | null = null;
  private newestReads: readonly string[] = [];

  constructor(private readonly lintProject: (content: string, provider: ResourceProvider | null) => ProjectLint) {}

  /**
   * The `res://` paths the newest lint's cross-file rules read, or may read: the glTF files it uses and the project
   * files the plugin probe reads. A host re-lints the document when one of them changes. Empty for a file that uses
   * nothing a cross-file rule reads.
   */
  get reads(): readonly string[] {
    return this.newestReads;
  }

  /**
   * Lints `content`, reading the files it uses through `provider`. With no provider, only the file's own rules run.
   *
   * @param content - Raw TSCN or TRES file content
   * @param provider - Loads a `res://` path of the file's project, or null for a file in no project
   */
  lint(content: string, provider: ResourceProvider | null): SessionLint {
    const lint = this.lintProject(content, provider);
    const token = Symbol('lint');
    this.newest = token;
    this.newestReads = lint.reads;
    if (lint.crossFile === null) {
      this.kept = NOTHING_KEPT;
      return { now: mergeDiagnostics(lint.local, []), later: null };
    }

    const now = mergeDiagnostics(lint.local, reanchored(this.kept, lint.gltfUses));
    const later = lint.crossFile.then((crossFile) => {
      if (this.newest !== token) return null;
      this.kept = { diagnostics: crossFile, gltfUses: lint.gltfUses };
      return mergeDiagnostics(lint.local, crossFile);
    });
    return { now, later };
  }
}
