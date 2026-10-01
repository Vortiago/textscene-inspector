/**
 * Whether code in a project can add to Godot's glTF importer (`gltf_document.cpp:6731-6732`, `:6798-6804`). Before the
 * editor's first scan imports a file, it loads each GDExtension the scan finds, the autoloads and the enabled editor
 * plugins (`editor_file_system.cpp:310-345`). ADR-0043 says why only the project file and a listing can rule them out.
 */

import type { ResourceProvider } from '../resources/ResourceProvider.js';
import {
  declaredAutoloads,
  enabledEditorPlugins,
  parseProjectSettings,
  projectDataDirectoryPath,
  projectExtensionListPath,
} from '../parser/projectSettingsParser.js';
import {
  GDEXTENSION_FILE_EXTENSION,
  PROJECT_FILE_PATH,
  extensionListEntries,
  extensionListPath,
} from '../godot/index.js';
import { StampedReads, loadOrNull, stampOf } from './stampedReads.js';

/**
 * Every `res://` path the probe may read: the project file, and the extension list under either data directory, since
 * which one it reads depends on the project file.
 */
export const PLUGIN_PROBE_PATHS: readonly string[] = [
  PROJECT_FILE_PATH,
  extensionListPath(true),
  extensionListPath(false),
];

/** What the probe reads from `project.godot`. */
interface ProjectFacts {
  /**
   * Whether the file settles that code may extend the importer: it is missing or unreadable, so nothing is proven, or
   * it enables an editor plugin (`editor_node.cpp:1164-1173`) or declares an autoload.
   */
  readonly mayRunCode: boolean;
  /** The `res://` path of the data directory, whose files the scan skips (`editor_file_system.cpp:3460-3464`). */
  readonly dataDirectory: string;
  /** Where it keeps the GDExtension list. */
  readonly listPath: string;
}

/** What the probe reads from the project's stamped files. */
interface ProjectEvidence extends ProjectFacts {
  /**
   * Whether the extension list names a GDExtension. Evidence that one exists, never proof that none does: Godot's own
   * `.gitignore` leaves the data directory out (`editor_vcs_interface.cpp:369`), so a fresh checkout has no list.
   */
  readonly listsExtension: boolean;
}

/** Whether code in the project behind a provider may add to the importer. The project is listed only when it is called. */
export type ImportExtensionProbe = () => Promise<boolean>;

/** The text of `path`, or null for a file the provider does not hold or cannot read. */
async function readText(provider: ResourceProvider, path: string): Promise<string | null> {
  const data = await loadOrNull(provider, path);
  if (data === null) return null;
  return typeof data === 'string' ? data : new TextDecoder().decode(data);
}

async function readProjectFacts(provider: ResourceProvider): Promise<ProjectFacts> {
  const text = await readText(provider, PROJECT_FILE_PATH);
  const settings = parseProjectSettings(text ?? '');
  const runsCode = enabledEditorPlugins(settings).length > 0 || declaredAutoloads(settings).length > 0;
  return {
    mayRunCode: text === null || runsCode,
    dataDirectory: projectDataDirectoryPath(settings),
    listPath: projectExtensionListPath(settings),
  };
}

/** Whether the GDExtension list names an extension to load (`gdextension_manager.cpp:319-334`). */
async function readListHasEntries(provider: ResourceProvider, path: string): Promise<boolean> {
  const text = await readText(provider, path);
  return text !== null && extensionListEntries(text).length > 0;
}

/**
 * Whether the project may hold a GDExtension the scan loads: true unless the provider lists the project and finds
 * none outside `dataDirectory`. A provider that cannot list, or whose listing rejects, proves nothing.
 */
async function mayHoldGdextension(provider: ResourceProvider, dataDirectory: string): Promise<boolean> {
  if (!provider.listFiles) return true;
  const listed = await provider.listFiles(GDEXTENSION_FILE_EXTENSION).catch(() => null);
  if (listed === null) return true;
  return listed.some((path) => !path.startsWith(`${dataDirectory}/`));
}

export class ProjectPluginProbes {
  private readonly projects = new StampedReads<ProjectFacts>();
  private readonly lists = new StampedReads<boolean>();

  /**
   * Starts reading the project files behind `provider` at once, and returns the answer. The project file and the
   * extension list are stamped in parallel, and one whose stamp is unchanged is neither read nor parsed again. The
   * answer lists the project only when those files leave it open, so a lint that refuses no glTF lists nothing.
   */
  probe(provider: ResourceProvider): ImportExtensionProbe {
    const evidence = this.readEvidence(provider);
    // Awaited only when the answer is asked for: the await there still throws, and an unawaited rejection stays silent.
    evidence.catch(() => undefined);
    return async () => {
      const { mayRunCode, dataDirectory, listsExtension } = await evidence;
      return mayRunCode || listsExtension || mayHoldGdextension(provider, dataDirectory);
    };
  }

  private async readEvidence(provider: ResourceProvider): Promise<ProjectEvidence> {
    const keptListPath = this.projects.peek(provider, PROJECT_FILE_PATH)?.listPath;
    const keptListStamp = keptListPath === undefined ? undefined : stampOf(provider, keptListPath);
    const project = await this.projects.get(provider, PROJECT_FILE_PATH, () => readProjectFacts(provider));
    if (project.mayRunCode) return { ...project, listsExtension: false };

    const { listPath } = project;
    const listStamp = listPath === keptListPath ? keptListStamp : undefined;
    const listsExtension = await this.lists.get(
      provider,
      listPath,
      () => readListHasEntries(provider, listPath),
      listStamp
    );
    return { ...project, listsExtension };
  }
}
