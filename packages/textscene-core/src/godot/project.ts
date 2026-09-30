/**
 * Where Godot 4.6.3 keeps a project's generated data, and the GDExtension list it keeps there.
 */

/**
 * `res://` plus the data directory's name: `.godot`, or `godot` when the project sets
 * `application/config/use_hidden_project_data_directory` to false (`project_settings.cpp:60-61`,
 * `:879-880`). The setting defaults to true (`:1694`).
 */
export function projectDataPath(useHiddenDirectory: boolean): string {
  return `res://${useHiddenDirectory ? '.' : ''}godot`;
}

/** The file in the data directory that lists the GDExtensions the project loads (`gdextension.cpp:45-46`). */
export const EXTENSION_LIST_FILE = 'extension_list.cfg';

/** The highest code `String::strip_edges` strips: every control character and the space (`ustring.cpp:4076`). */
const STRIPPED_MAX_CODE = 32;

/** `String::strip_edges`: every character up to 32 goes from each end, and nothing else (`ustring.cpp:4070-4099`). */
function stripEdges(text: string): string {
  let begin = 0;
  let end = text.length;
  while (begin < end && text.charCodeAt(begin) <= STRIPPED_MAX_CODE) begin++;
  while (end > begin && text.charCodeAt(end - 1) <= STRIPPED_MAX_CODE) end--;
  return text.slice(begin, end);
}

/**
 * The extension paths `load_extensions` loads from an `extension_list.cfg`: each line with its edges stripped, a
 * blank one skipped (`gdextension_manager.cpp:324-330`).
 */
export function extensionListEntries(text: string): string[] {
  return text
    .split('\n')
    .map(stripEdges)
    .filter((entry) => entry !== '');
}
