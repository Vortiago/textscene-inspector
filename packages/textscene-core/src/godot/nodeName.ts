/**
 * What a node may be called — `core/string/ustring.cpp`.
 */

/**
 * The characters a node name may not carry (`ustring.cpp:5071`).
 *
 * `%` is here because it opens a unique-name segment, and `.`, `:` and `/`
 * because each is NodePath punctuation; `@` marks an engine-generated name.
 */
const INVALID_NODE_NAME_CHARS = new Set(['.', ':', '@', '/', '"', '%']);

/**
 * The name `Node::set_name` actually stores: every invalid character replaced
 * by `_` (`ustring.cpp:5119-5131`, applied at `node.cpp:1441`).
 *
 * A caller that reports the name Godot ends up with has to run the text through
 * this — the engine never stores the string handed to `set_name` when one of
 * those characters is in it, and `@` and `.` both reach it whenever a name is
 * built out of a NodePath.
 */
export function validateNodeName(name: string): string {
  let validated = '';
  for (const character of name) {
    validated += INVALID_NODE_NAME_CHARS.has(character) ? '_' : character;
  }
  return validated;
}
