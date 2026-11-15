/**
 * Reads the type lists of Godot's `Variant::can_convert_strict` (variant.cpp:535): for each target
 * type, the source types it takes besides itself and NIL. A case this does not understand throws.
 */

const CASE = /case (\w+): \{([\s\S]*?)\} break;/g;
const LIST = /static const Type valid\[\] = \{([\s\S]*?)\};\s*valid_types = valid;\s*$/;

/** `{ target: [source, ...] }` from `cpp`, the text of variant.cpp. */
export function strictConversions(cpp) {
  const start = cpp.indexOf('bool Variant::can_convert_strict(');
  if (start === -1) throw new Error('expected can_convert_strict in variant.cpp, found none');
  const end = cpp.indexOf('\n}', start);
  const body = cpp.slice(cpp.indexOf('switch (p_type_to) {', start), end);
  const table = {};
  for (const [, target, statements] of body.matchAll(CASE)) {
    const list = LIST.exec(statements);
    if (!list)
      throw new Error(
        `expected a valid[] list for ${target} in can_convert_strict, got ${statements.trim()}`
      );
    const types = list[1]
      .split('\n')
      .map((line) =>
        line
          .replace(/\/\/.*/, '')
          .trim()
          .replace(/,$/, '')
      )
      .filter((type) => type !== '');
    const nil = types.indexOf('NIL');
    table[target] = nil === -1 ? types : types.slice(0, nil);
  }
  return table;
}
