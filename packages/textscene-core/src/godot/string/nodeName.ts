/** What a node may be called: `core/string/ustring.cpp`. */

/**
 * The characters a node name may not carry (`ustring.cpp:5071`).
 *
 * `%` is here because it opens a unique-name segment, and `.`, `:` and `/`
 * because each is NodePath punctuation; `@` marks an engine-generated name.
 */
const INVALID_NODE_NAME_CHARS = new Set(['.', ':', '@', '/', '"', '%']);

/**
 * The name `Node::set_name` stores: every invalid character replaced by `_` (`ustring.cpp:5119-5131`,
 * applied at `node.cpp:1441`). A caller reporting the name Godot ends up with runs the text through
 * this, as `@` and `.` reach it whenever a name is built from a NodePath.
 */
export function validateNodeName(name: string): string {
  let validated = '';
  for (const character of name) {
    validated += INVALID_NODE_NAME_CHARS.has(character) ? '_' : character;
  }
  return validated;
}

/**
 * The name `Node::set_name` leaves a child once a sibling holds it: a number past the name's own
 * trailing digits, counting up from 2 (`node.cpp:1593-1640`, with the default empty
 * `editor/naming/node_name_num_separator`). The name stays as it is where no sibling holds it.
 */
export function serialChildName(name: string, siblings: ReadonlySet<string>): string {
  if (!siblings.has(name)) return name;
  const trailingDigits = /\d*$/.exec(name)![0];
  const stem = name.slice(0, name.length - trailingDigits.length);
  let number = trailingDigits;
  for (;;) {
    const attempt = stem + number;
    if (!siblings.has(attempt)) return attempt;
    number = number === '' ? '2' : increaseNumericString(number);
  }
}

/** `s + 1` as an integer written in decimal, with no width limit (`node.cpp:1569-1597`). */
function increaseNumericString(digits: string): string {
  let carriedDigits = '';
  for (let i = digits.length - 1; i >= 0; i--) {
    if (digits[i] !== '9') {
      return digits.slice(0, i) + String.fromCharCode(digits.charCodeAt(i) + 1) + carriedDigits;
    }
    carriedDigits += '0';
  }
  return '1' + carriedDigits;
}
