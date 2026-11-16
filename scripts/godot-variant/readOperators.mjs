import { registerStatements } from '../godot-shader-language/cppText.mjs';
import { splitArguments } from './cppArguments.mjs';

const REGISTER_OP = /^register_op<(\w+)(?:<(.*)>)?>\(Variant::(\w+), Variant::(\w+), Variant::(\w+)\);$/;
const MACRO_CALL = /^(\w+)\((.*)\);$/;

/** Each `#define register_*(params) body` of `cpp`, by name, with its body statements. */
function registerMacros(cpp) {
  const macros = new Map();
  const define = /^#define (register_\w+)\(([^)]*)\)((?:.*\\\n)*.*)$/gm;
  for (const match of cpp.matchAll(define)) {
    const statements = match[3]
      .split('\n')
      .map((line) => line.replace(/\\$/, '').trim())
      .filter((line) => line.startsWith('register_op<'));
    macros.set(match[1], { parameters: splitArguments(match[2]), statements });
  }
  return macros;
}

function substitute(statement, parameters, values) {
  return parameters.reduce(
    (text, parameter, index) => text.replace(new RegExp(`\\b${parameter}\\b`, 'g'), values[index]),
    statement
  );
}

function registration(statement, line) {
  const match = REGISTER_OP.exec(statement);
  if (!match) throw new Error(`expected a register_op statement at variant_op.cpp:${line}, got ${statement}`);
  const [, evaluator, types, operator, left, right] = match;
  return { operator, left, right, evaluator, types: splitArguments(types ?? ''), line };
}

/** The rows of `_register_variant_operators` in `cpp`, the text of variant_op.cpp. */
export function operatorRegistrations(cpp) {
  const macros = registerMacros(cpp);
  return registerStatements(cpp, '_register_variant_operators', 'variant_op.cpp').flatMap(
    ({ statement, line }) => {
      if (statement.startsWith('memset(')) return [];
      if (statement.startsWith('register_op<')) return [registration(statement, line)];
      const call = MACRO_CALL.exec(statement);
      const macro = call && macros.get(call[1]);
      if (!macro)
        throw new Error(
          `expected a register_op or register macro at variant_op.cpp:${line}, got ${statement}`
        );
      const values = splitArguments(call[2]);
      return macro.statements.map((body) => registration(substitute(body, macro.parameters, values), line));
    }
  );
}
