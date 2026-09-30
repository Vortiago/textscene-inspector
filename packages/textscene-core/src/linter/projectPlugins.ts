/**
 * Whether a project can add to Godot's glTF importer. A `GLTFDocumentExtension` joins the supported set once something
 * registers it (`gltf_document.cpp:6731-6732`, `:6798-6804`), and in a project only an editor plugin or a GDExtension
 * runs code in the editor that imports the file. The answer comes from the two files where the editor records both.
 */

import type { ResourceProvider } from '../resources/ResourceProvider.js';
import { enabledEditorPlugins, parseProjectSettings, projectExtensionListPath } from '../parser/projectSettingsParser.js';
import { PROJECT_FILE_PATH, extensionListEntries, extensionListPath } from '../godot/index.js';
import { StampedReads, loadOrNull, stampOf } from './stampedReads.js';

/**
 * Every `res://` path the probe may read: the project file, and the extension list under either data directory, since
 * which one it reads depends on the project file.
 */
export const PLUGIN_PROBE_PATHS: readonly string[] = [PROJECT_FILE_PATH, extensionListPath(true), extensionListPath(false)];

/** What the probe reads from `project.godot`. */
interface ProjectFacts {
  /** Whether it enables an editor plugin (`editor_node.cpp:1167-1173`). */
  readonly enablesPlugin: boolean;
  /** Where it keeps the GDExtension list. */
  readonly listPath: string;
}

/** The text of `path`, or null for a file the provider does not hold or cannot read: both read as "none". */
async function readText(provider: ResourceProvider, path: string): Promise<string | null> {
  const data = await loadOrNull(provider, path);
  if (data === null) return null;
  return typeof data === 'string' ? data : new TextDecoder().decode(data);
}

async function readProjectFacts(provider: ResourceProvider): Promise<ProjectFacts> {
  const settings = parseProjectSettings((await readText(provider, PROJECT_FILE_PATH)) ?? '');
  return { enablesPlugin: enabledEditorPlugins(settings).length > 0, listPath: projectExtensionListPath(settings) };
}

/** Whether the GDExtension list names an extension to load (`gdextension_manager.cpp:319-334`). */
async function readListHasEntries(provider: ResourceProvider, path: string): Promise<boolean> {
  const text = await readText(provider, path);
  return text !== null && extensionListEntries(text).length > 0;
}

export class ProjectPluginProbes {
  private readonly projects = new StampedReads<ProjectFacts>();
  private readonly lists = new StampedReads<boolean>();

  /**
   * True when the project behind `provider` enables an editor plugin or lists a GDExtension to load. A missing or
   * unreadable file counts as none. Both files are stamped in parallel, and one whose stamp is unchanged is neither
   * read nor parsed again.
   */
  async mayExtendGltfImport(provider: ResourceProvider): Promise<boolean> {
    const keptListPath = this.projects.peek(provider, PROJECT_FILE_PATH)?.listPath;
    const keptListStamp = keptListPath === undefined ? undefined : stampOf(provider, keptListPath);
    const project = await this.projects.get(provider, PROJECT_FILE_PATH, () => readProjectFacts(provider));
    if (project.enablesPlugin) return true;

    const { listPath } = project;
    const listStamp = listPath === keptListPath ? keptListStamp : undefined;
    return this.lists.get(provider, listPath, () => readListHasEntries(provider, listPath), listStamp);
  }
}
