/**
 * Godot's text resource formats: the extensions its text loader and saver recognise, and the one
 * test for them. `.tscn` and `.tres` are one grammar: a `.tres` carries its type in the
 * `[gd_resource]` header, and a `[sub_resource]` block gets the validators a resource file gets.
 * Every consumer asks here rather than spell out a set, an `endsWith` pair or an `extname()` lookup.
 */

/**
 * The two extensions, dotted, in the order `ResourceFormatLoaderText::get_recognized_extensions`
 * pushes them (resource_format_text.cpp:1482-1484). The saver picks between them by whether the
 * resource is a PackedScene (:2226-2230). Dotted because `recognize_path` prepends the `.` to each
 * extension before comparing (resource_loader.cpp:71-74).
 */
export const GODOT_TEXT_RESOURCE_EXTENSIONS = ['.tscn', '.tres'] as const;

/**
 * Whether `path` names a Godot text resource, case-insensitive like Godot: `recognize_path` compares with
 * `nocasecmp_to` (resource_loader.cpp:73) and the text loader lowercases the extension (resource_format_text.cpp:1552).
 * A suffix test, not an extension lookup: `String::get_extension` has no leading-dot special case
 * (ustring.cpp:5037-5043), so `.tscn` has extension `tscn` to Godot, where Node's `extname('.tscn')` returns `''`.
 */
export function isGodotTextResourcePath(path: string): boolean {
  const lower = path.toLowerCase();
  return GODOT_TEXT_RESOURCE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}
