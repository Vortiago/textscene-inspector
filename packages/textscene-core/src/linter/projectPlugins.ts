/**
 * Whether a project can add to Godot's glTF importer. A `GLTFDocumentExtension` joins the supported set once something
 * registers it (`gltf_document.cpp:6731-6732`, `:6798-6804`), and in a project only an editor plugin or a GDExtension
 * runs code in the editor that imports the file. Read through the linter's `ResourceProvider`, which lists no
 * directory, so the answer comes from the two files where the editor records both.
 */

import type { ResourceProvider } from '../resources/ResourceProvider.js';
import { enabledEditorPlugins, extensionListPath, parseProjectSettings } from '../parser/projectSettingsParser.js';
import { extensionListEntries } from '../godot/index.js';

/** The project's settings, at the `res://` root (`project_settings.cpp:793`). */
const PROJECT_FILE = 'res://project.godot';

/** The text of `path`, or null for a file the provider does not hold or cannot read: both read as "none". */
async function readText(provider: ResourceProvider, path: string): Promise<string | null> {
  const data = await provider.loadResource(path).catch(() => null);
  if (data === null) return null;
  return typeof data === 'string' ? data : new TextDecoder().decode(data);
}

/**
 * True when the project enables an editor plugin (`editor_node.cpp:1167-1173`) or lists a GDExtension to load
 * (`gdextension_manager.cpp:319-334`). A missing or unreadable file counts as none.
 */
export async function projectMayExtendGltfImport(provider: ResourceProvider): Promise<boolean> {
  const settings = parseProjectSettings((await readText(provider, PROJECT_FILE)) ?? '');
  if (enabledEditorPlugins(settings).length > 0) return true;
  const extensionList = await readText(provider, extensionListPath(settings));
  return extensionList !== null && extensionListEntries(extensionList).length > 0;
}
