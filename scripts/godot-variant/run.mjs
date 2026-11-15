#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkGenerated, writeGenerated } from '../generatedFile.mjs';
import { godotSourceDir } from '../godotSource.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';
import { constructorRegistrations } from './readConstructors.mjs';
import { strictConversions } from './readConversions.mjs';
import { operatorRegistrations } from './readOperators.mjs';
import { utilityFunctions } from './readUtilities.mjs';

const TABLE_MODULE = join(REPO_ROOT, 'packages/textscene-core/src/godot/variant/registrations.generated.ts');

const json = (value) => JSON.stringify(value);

/** The module text of the four tables. */
export function renderTables({ operators, constructors, conversions, utilities }) {
  const operatorRows = operators.map(
    ({ operator, left, right, evaluator, types }) =>
      `  [${json(operator)}, ${json(left)}, ${json(right)}, ${json(evaluator)}, ${json(types)}],`
  );
  const constructorRows = constructors.map(
    ({ constructor, types, arguments: names }) => `  [${json(constructor)}, ${json(types)}, ${names.length}],`
  );
  const conversionRows = Object.entries(conversions).map(
    ([target, sources]) => `  ${target}: ${json(sources)},`
  );
  const utilityRows = utilities.map(
    ({ name, argumentCount, isVararg }) => `  [${json(name)}, ${argumentCount}, ${isVararg}],`
  );
  return `/**
 * Godot 4.6.3's Variant registrations, read from its source.
 * AUTO-GENERATED - Do not edit manually. Run: pnpm godot:variant
 */

/** variant_op.cpp:212: operator, left type, right type, evaluator class, its template types. */
export const OPERATOR_REGISTRATIONS: readonly (readonly [string, string, string, string, readonly string[]])[] = [
${operatorRows.join('\n')}
];

/** variant_construct.cpp:59 in its order: constructor class, its template types, argument count. */
export const CONSTRUCTOR_REGISTRATIONS: readonly (readonly [string, readonly string[], number])[] = [
${constructorRows.join('\n')}
];

/** variant.cpp:535: the types each target takes besides itself and NIL. */
export const STRICT_CONVERSIONS: Readonly<Record<string, readonly string[]>> = {
${conversionRows.join('\n')}
};

/** variant_utility.cpp:1630: name, argument count, whether it takes any count. */
export const UTILITY_FUNCTIONS: readonly (readonly [string, number, boolean])[] = [
${utilityRows.join('\n')}
];
`;
}

function main() {
  const variantDir = join(godotSourceDir(process.argv), 'core/variant');
  const read = (file) => readFileSync(join(variantDir, file), 'utf8');
  const tables = {
    operators: operatorRegistrations(read('variant_op.cpp')),
    constructors: constructorRegistrations(read('variant_construct.cpp')),
    conversions: strictConversions(read('variant.cpp')),
    utilities: utilityFunctions(read('variant_utility.cpp')),
  };
  const summary = `${tables.operators.length} operators, ${tables.constructors.length} constructors, ${tables.utilities.length} utility functions`;
  const outputs = [[TABLE_MODULE, renderTables(tables)]];
  const options = { tool: 'godot-variant', summary };
  if (process.argv.includes('--check'))
    checkGenerated(outputs, { ...options, command: 'pnpm godot:variant' });
  else writeGenerated(outputs, options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
