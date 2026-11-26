import type { LoadFailureCause } from '../resources/loadFailure/loadOutcome.js';

/** `loading` until the loads answer, then whether the game would load the file. */
export type SceneFileState = 'loading' | 'loaded' | 'missing';

/** Why a file fails: the file, each text file through which it fails, and the file that failed first. */
export interface SceneFileFailure {
  readonly chain: readonly string[];
  readonly cause: LoadFailureCause;
  /** Each **Sub-resource path** the file does not declare, a dialog row each. Empty where the file fails. */
  readonly addresses: readonly string[];
}

/** Why the game refuses the whole scene (resource_format_text.cpp:647-650). */
export interface SceneFailure {
  /** Godot's error line, with the line number of the read. */
  readonly line: string;
  /** The file the scene reads and each file through which it fails, the address the file lacks, or none. */
  readonly chain: readonly string[];
  readonly cause: LoadFailureCause;
}

/** One row of Godot's Load Errors dialog (dependency_editor.cpp:802-826). */
export interface SceneFile {
  readonly path: string;
  /** The type the first file that names it gives, or null where none gives one. */
  readonly type: string | null;
  readonly state: SceneFileState;
  /** The files that name it, in the order the load reaches them. */
  readonly owners: readonly string[];
  /** Null unless the file is missing. */
  readonly reason: SceneFileFailure | null;
  /** The **Sub-resource path**s inside the file that the scene's files name. */
  readonly addresses: readonly string[];
}
