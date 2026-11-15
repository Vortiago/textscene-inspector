/**
 * Reads the operator registrations of Godot's `Variant::_register_variant_operators`
 * (variant_op.cpp:212) into rows: operator, left and right type, evaluator class and its template
 * types. A statement this does not understand throws, so a row is never dropped in silence.
 */

import { lineAt } from '../godot-shader-language/cppText.mjs';

const REGISTER_OP = /^register_op<(\w+)(?:<(.*)>)?>\(Variant::(\w+), Variant::(\w+), Variant::(\w+)\);$/;
const MACRO_CALL = /^(\w+)\((.*)\);$/;

/** The top-level comma-separated parts of `text`, with `<...>` nesting kept whole. */
function splitArguments(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '<') depth += 1;
    else if (char === '>') depth -= 1;
    else if (char === ',' && depth === 0) {
      parts.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (text.trim() !== '') parts.push(text.slice(start).trim());
  return parts;
}

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
  const start = cpp.indexOf('void Variant::_register_variant_operators() {');
  if (start === -1) throw new Error('expected _register_variant_operators in variant_op.cpp, found none');
  const end = cpp.indexOf('\n}', start);
  const macros = registerMacros(cpp);
  const firstLine = lineAt(cpp, start);
  return cpp
    .slice(start, end)
    .split('\n')
    .slice(1)
    .flatMap((raw, index) => {
      const statement = raw.trim();
      const line = firstLine + 1 + index;
      if (statement === '' || statement.startsWith('//') || statement.startsWith('memset(')) return [];
      if (statement.startsWith('register_op<')) return [registration(statement, line)];
      const call = MACRO_CALL.exec(statement);
      const macro = call && macros.get(call[1]);
      if (!macro)
        throw new Error(
          `expected a register_op or register macro at variant_op.cpp:${line}, got ${statement}`
        );
      const values = splitArguments(call[2]);
      return macro.statements.map((body) => registration(substitute(body, macro.parameters, values), line));
    });
}
