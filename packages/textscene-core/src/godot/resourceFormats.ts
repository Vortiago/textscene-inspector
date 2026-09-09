/**
 * Godot's TEXT resource formats — the file extensions its text loader and saver
 * recognise, and the one test for them.
 *
 * `ResourceFormatLoaderText::get_recognized_extensions` pushes exactly `tscn`
 * and `tres` (resource_format_text.cpp:1482-1484), and the saver picks between
 * the same two by whether the resource is a PackedScene (:2226-2230). They are
 * one grammar: a `.tres` carries its type in the `[gd_resource]` header rather
 * than a section heading, and the validators a `[sub_resource]` block gets
 * inside a scene are the ones a standalone resource file gets.
 *
 * Every consumer — the CLI walk, the editor's document filter, the fixture
 * sweep — asks the same question, so they ask it here rather than each spelling
 * out a set, a pair of `endsWith` calls, or an `extname()` lookup that disagrees
 * with both on a file named `.tscn`.
 */

/**
 * The two extensions, dotted, in the order the loader lists them.
 *
 * Dotted because that is the form a path is matched against: `recognize_path`
 * prepends the `.` to each recognised extension before comparing
 * (resource_loader.cpp:71-74).
 */
export const GODOT_TEXT_RESOURCE_EXTENSIONS = ['.tscn', '.tres'] as const;

/**
 * Whether `path` names a Godot text resource — CASE-INSENSITIVE, because Godot
 * is: `recognize_path` compares the path's tail with `nocasecmp_to`
 * (resource_loader.cpp:73), and the text loader lowercases the extension before
 * matching it (resource_format_text.cpp:1552). `Model.TRES` is a file the engine
 * loads, so it is a file this linter reads.
 *
 * A suffix test, not an extension lookup: `String::get_extension` reads back
 * from the last `.` with no leading-dot special case (ustring.cpp:5037-5043), so a file
 * named `.tscn` has extension `tscn` to Godot — where Node's `extname('.tscn')`
 * returns `''` and drops it.
 */
export function isGodotTextResourcePath(path: string): boolean {
  const lower = path.toLowerCase();
  return GODOT_TEXT_RESOURCE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}
