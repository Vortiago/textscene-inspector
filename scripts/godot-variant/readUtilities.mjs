import { splitArguments } from './cppArguments.mjs';

const BIND =
  /^(FUNCBIND\w*)\((\w+), (?:\w+, )?(sarray\((.*)\)|Vector<String>\(\)), Variant::UTILITY_FUNC_TYPE_\w+\);$/;

/** The rows of `_register_variant_utility_functions` in `cpp`, the text of variant_utility.cpp. */
export function utilityFunctions(cpp) {
  const start = cpp.indexOf('void Variant::_register_variant_utility_functions() {');
  if (start === -1)
    throw new Error('expected _register_variant_utility_functions in variant_utility.cpp, found none');
  const end = cpp.indexOf('\n}', start);
  return cpp
    .slice(start, end)
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('//'))
    .map((line) => {
      const match = BIND.exec(line);
      if (!match) throw new Error(`expected a FUNCBIND statement in variant_utility.cpp, got ${line}`);
      const [, macro, name, , names] = match;
      return {
        name,
        argumentCount: splitArguments(names ?? '').length,
        isVararg: macro.startsWith('FUNCBINDVARARG'),
      };
    });
}
