#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkGenerated, writeGenerated } from '../generatedFile.mjs';
import { godotSourceDir } from '../godotSource.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';
import { builtinTypes, dumpExtensionApi } from './readBuiltinTypes.mjs';
import { caseTables, characterClasses } from './readStringTables.mjs';
import { constructorRegistrations } from './readConstructors.mjs';
import { strictConversions } from './readConversions.mjs';
import { errorNames } from './readErrorNames.mjs';
import { operatorRegistrations } from './readOperators.mjs';
import { utilityFunctions } from './readUtilities.mjs';

const TABLE_MODULE = join(REPO_ROOT, 'packages/textscene-core/src/godot/variant/registrations.generated.ts');

const BUILTIN_MODULE = join(
  REPO_ROOT,
  'packages/textscene-core/src/godot/variant/call/builtinTypes.generated.ts'
);
const CASE_MODULE = join(REPO_ROOT, 'packages/textscene-core/src/godot/string/caseTables.generated.ts');
const CLASS_MODULE = join(
  REPO_ROOT,
  'packages/textscene-core/src/godot/string/characterClasses.generated.ts'
);

const GODOT_RELEASE = 'Godot Engine v4.6.3.stable';

const json = (value) => JSON.stringify(value);

/** The module text of the five tables. */
export function renderTables({ operators, constructors, conversions, utilities, errors }) {
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
    ({ name, argumentCount, isVararg, kind, parameters }) =>
      `  [${json(name)}, ${argumentCount}, ${isVararg}, ${json(kind)}, ${json(parameters)}],`
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

/** variant_utility.cpp:1630: name, argument count, any count, call kind, typed C++ parameters. */
export const UTILITY_FUNCTIONS: readonly (readonly [string, number, boolean, string, readonly string[]])[] = [
${utilityRows.join('\n')}
];

/** error_list.cpp:35: the name of each Error code, by its value. */
export const ERROR_NAMES: readonly string[] = [
${errors.map((name) => `  ${json(name)},`).join('\n')}
];
`;
}

const methodList = (methods) =>
  methods.length === 0 ? '[]' : `[\n${methods.map((method) => `      ${json(method)},`).join('\n')}\n    ]`;

/** The module text of the builtin types, keyed by their Godot names. */
export function renderBuiltinTypes(types) {
  const typeRows = types.map(
    ({ name, members, indexing, isKeyed, methods }) => `  ${name}: {
    members: ${json(members)},
    indexing: ${json(indexing)},
    isKeyed: ${isKeyed},
    methods: ${methodList(methods)},
  },`
  );
  return `/**
 * Godot 4.6.3's builtin types, read from its extension API.
 * AUTO-GENERATED - Do not edit manually. Run: pnpm godot:variant
 */

/** Name, return type or "", flags (1 const, 2 static, 4 vararg), hash, each argument's type and default. */
export type BuiltinMethodRow = readonly [string, string, number, number, readonly (readonly [string, string?])[]];

export interface BuiltinTypeRow {
  /** Each named member and its type. */
  readonly members: readonly (readonly [string, string])[];
  /** The type an integer index reads, or "" where the type has no indexing. */
  readonly indexing: string;
  readonly isKeyed: boolean;
  readonly methods: readonly BuiltinMethodRow[];
}

export const BUILTIN_TYPES: Readonly<Record<string, BuiltinTypeRow>> = {
${typeRows.join('\n')}
};
`;
}

const runRows = (runs) => runs.map((run) => `  ${json(run)},`).join('\n');

/** The module text of the two case tables. */
export function renderCaseTables({ upper, lower }) {
  return `/**
 * Godot 4.6.3's simple case mappings, read from core/string/ucaps.h.
 * AUTO-GENERATED - Do not edit manually. Run: pnpm godot:variant
 */

/** A run of \`[first, count, step, delta]\`: each code \`first + k * step\` maps to itself plus \`delta\`. */
export type CaseRun = readonly [number, number, number, number];

/** \`caps_table\` (ucaps.h:38), in code order. */
export const UPPER_CASE_RUNS: readonly CaseRun[] = [
${runRows(upper)}
];

/** \`reverse_caps_table\` (ucaps.h:1518), in code order. */
export const LOWER_CASE_RUNS: readonly CaseRun[] = [
${runRows(lower)}
];
`;
}

/** Flat numbers, twelve to a line. */
function numberRows(numbers) {
  const rows = [];
  for (let at = 0; at < numbers.length; at += 12) rows.push(`  ${numbers.slice(at, at + 12).join(', ')},`);
  return rows.join('\n');
}

const CLASS_TABLES = [
  ['IDENTIFIER_START', 'xid_start', 'identifierStart'],
  ['IDENTIFIER_CONTINUE', 'xid_continue', 'identifierContinue'],
  ['UPPER_CASE_LETTER', 'uppercase_letter', 'upperCase'],
  ['LOWER_CASE_LETTER', 'lowercase_letter', 'lowerCase'],
];

/** The module text of the five character classes, each as flat start and end pairs. */
export function renderCharacterClasses(classes) {
  const tables = CLASS_TABLES.map(
    ([
      constant,
      table,
      key,
    ]) => `/** \`${table}\` (char_range.inc): inclusive ranges, as start, end, start, end. */
export const ${constant}: readonly number[] = [
${numberRows(classes[key])}
];`
  );
  return `/**
 * Godot 4.6.3's Unicode character classes, read from core/string/char_range.inc.
 * AUTO-GENERATED - Do not edit manually. Run: pnpm godot:variant
 */

${tables.join('\n\n')}
`;
}

/** The builtin types of the running Godot, which must be the pinned release. */
function readBuiltinTypes() {
  const api = JSON.parse(dumpExtensionApi());
  if (!api.header.version_full_name.startsWith(GODOT_RELEASE))
    throw new Error(`expected ${GODOT_RELEASE}, got ${api.header.version_full_name}`);
  return builtinTypes(api);
}

function main() {
  const coreDir = join(godotSourceDir(process.argv), 'core');
  const read = (file) => readFileSync(join(coreDir, 'variant', file), 'utf8');
  const tables = {
    operators: operatorRegistrations(read('variant_op.cpp')),
    constructors: constructorRegistrations(read('variant_construct.cpp')),
    conversions: strictConversions(read('variant.cpp')),
    utilities: utilityFunctions(read('variant_utility.cpp'), read('variant_utility.h')),
    errors: errorNames(readFileSync(join(coreDir, 'error/error_list.cpp'), 'utf8')),
  };
  const summary = `${tables.operators.length} operators, ${tables.constructors.length} constructors, ${tables.utilities.length} utility functions`;
  const outputs = [
    [TABLE_MODULE, renderTables(tables)],
    [BUILTIN_MODULE, renderBuiltinTypes(readBuiltinTypes())],
    [CASE_MODULE, renderCaseTables(caseTables(readFileSync(join(coreDir, 'string/ucaps.h'), 'utf8')))],
    [
      CLASS_MODULE,
      renderCharacterClasses(characterClasses(readFileSync(join(coreDir, 'string/char_range.inc'), 'utf8'))),
    ],
  ];
  const options = { tool: 'godot-variant', summary };
  if (process.argv.includes('--check'))
    checkGenerated(outputs, { ...options, command: 'pnpm godot:variant' });
  else writeGenerated(outputs, options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
