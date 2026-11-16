import { splitArguments } from './cppArguments.mjs';

const BIND =
  /^(FUNCBIND\w*)\((\w+), (?:(\w+), )?(sarray\((.*)\)|Vector<String>\(\)), Variant::UTILITY_FUNC_TYPE_\w+\);$/;

// FUNCBINDR and FUNCBIND check each argument against a C++ type, the others take Variants as they are.
const CALL_KIND = {
  FUNCBINDR: 'typed',
  FUNCBIND: 'typed',
  FUNCBINDVR: 'variant',
  FUNCBINDVR2: 'variant',
  FUNCBINDVR3: 'variant',
  FUNCBINDVARARG: 'vararg',
  FUNCBINDVARARGS: 'vararg',
  FUNCBINDVARARGV: 'vararg',
  FUNCBINDVARARGV_CNAME: 'vararg',
};

const DECLARATION = /static\s+([\w:<>* ]+?)\s*\b(\w+)\(([^)]*)\);/g;

/** `const Variant &` and `Variant::Type` as the bare type a caster reads: `Variant`, `Variant::Type`. */
function parameterType(parameter) {
  const name = /\s*\b\w+$/.exec(parameter);
  return parameter
    .slice(0, name.index)
    .replace(/^const\s+/, '')
    .replace(/\s*&$/, '')
    .trim();
}

/** The C++ parameter types of each function `VariantUtilityFunctions` declares in variant_utility.h. */
export function utilityDeclarations(header) {
  const declarations = new Map();
  for (const [, , name, parameters] of header.matchAll(DECLARATION))
    declarations.set(name, splitArguments(parameters.replace(/\s+/g, ' ')).map(parameterType));
  return declarations;
}

/** The rows of `_register_variant_utility_functions` in `cpp`, the text of variant_utility.cpp. */
export function utilityFunctions(cpp, header) {
  const start = cpp.indexOf('void Variant::_register_variant_utility_functions() {');
  if (start === -1)
    throw new Error('expected _register_variant_utility_functions in variant_utility.cpp, found none');
  const end = cpp.indexOf('\n}', start);
  const declarations = utilityDeclarations(header);
  return cpp
    .slice(start, end)
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('//'))
    .map((line) => {
      const match = BIND.exec(line);
      if (!match) throw new Error(`expected a FUNCBIND statement in variant_utility.cpp, got ${line}`);
      const [, macro, bound, cppName = bound, , names] = match;
      const kind = CALL_KIND[macro];
      if (kind === undefined) throw new Error(`expected a known FUNCBIND macro, got ${macro}`);
      const parameters = declarations.get(cppName);
      if (parameters === undefined)
        throw new Error(`expected a declaration of ${cppName} in variant_utility.h, found none`);
      return {
        name: bound.replace(/^_/, ''),
        argumentCount: splitArguments(names ?? '').length,
        isVararg: kind === 'vararg',
        kind,
        parameters: kind === 'typed' ? parameters : [],
      };
    });
}
