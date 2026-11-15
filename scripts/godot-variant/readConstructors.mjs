import { lineAt } from '../godot-shader-language/cppText.mjs';
import { splitArguments } from './cppArguments.mjs';

const ADD_CONSTRUCTOR = /^add_constructor<(\w+)(?:<(.*)>)?>\(sarray\((.*)\)\);$/;

/** The rows of `_register_variant_constructors` in `cpp`, the text of variant_construct.cpp. */
export function constructorRegistrations(cpp) {
  const start = cpp.indexOf('void Variant::_register_variant_constructors() {');
  if (start === -1)
    throw new Error('expected _register_variant_constructors in variant_construct.cpp, found none');
  const end = cpp.indexOf('\n}', start);
  const firstLine = lineAt(cpp, start);
  return cpp
    .slice(start, end)
    .split('\n')
    .slice(1)
    .flatMap((raw, index) => {
      const statement = raw.trim();
      const line = firstLine + 1 + index;
      if (statement === '' || statement.startsWith('//')) return [];
      const match = ADD_CONSTRUCTOR.exec(statement);
      if (!match)
        throw new Error(
          `expected an add_constructor statement at variant_construct.cpp:${line}, got ${statement}`
        );
      const names = splitArguments(match[3]).map((name) => JSON.parse(name));
      return [{ constructor: match[1], types: splitArguments(match[2] ?? ''), arguments: names, line }];
    });
}
