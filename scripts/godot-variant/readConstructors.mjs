import { registerStatements } from '../godot-shader-language/cppText.mjs';
import { splitArguments } from './cppArguments.mjs';

const ADD_CONSTRUCTOR = /^add_constructor<(\w+)(?:<(.*)>)?>\(sarray\((.*)\)\);$/;

/** The rows of `_register_variant_constructors` in `cpp`, the text of variant_construct.cpp. */
export function constructorRegistrations(cpp) {
  return registerStatements(cpp, '_register_variant_constructors', 'variant_construct.cpp').map(
    ({ statement, line }) => {
      const match = ADD_CONSTRUCTOR.exec(statement);
      if (!match)
        throw new Error(
          `expected an add_constructor statement at variant_construct.cpp:${line}, got ${statement}`
        );
      const names = splitArguments(match[3]).map((name) => JSON.parse(name));
      return { constructor: match[1], types: splitArguments(match[2] ?? ''), arguments: names, line };
    }
  );
}
