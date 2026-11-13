/**
 * Parses the vendored Godot 4.6.3 shading language sources into the rows of the instruction table.
 * Each function takes a file's text and answers rows, so a test runs on an excerpt. A construct
 * of a table this does not understand throws: a row is never dropped in silence.
 */

import { enumMembers, lineAt } from './cppText.mjs';
import { operatorSignatures } from './operatorRules.mjs';

/** The lower-case name of a `TYPE_*` enumerator, as the shading language spells it. */
export function typeName(enumerator, keywords) {
  const keyword = keywords.find((entry) => entry.token === `TK_${enumerator}`);
  if (keyword) return keyword.text;
  if (enumerator === 'TYPE_STRUCT') return 'struct';
  throw new Error(`expected a keyword for ${enumerator}, found none`);
}

/**
 * The entries of `keyword_list` (`shader_language.cpp:283`): each token, its text, the heading
 * comment it sits under (`data types`, `hints`, ...) and its line. Entries above the first heading
 * have the heading `literals`.
 */
export function keywordList(cpp) {
  const start = cpp.indexOf('const ShaderLanguage::KeyWord ShaderLanguage::keyword_list[] = {');
  if (start === -1) throw new Error('expected keyword_list in shader_language.cpp, found none');
  const end = cpp.indexOf('{ TK_ERROR, nullptr', start);
  const firstLine = lineAt(cpp, start);
  let heading = 'literals';
  const entries = [];
  cpp
    .slice(start, end)
    .split('\n')
    .forEach((raw, index) => {
      const line = raw.trim();
      const comment = /^\/\/ (.+)$/.exec(line);
      if (comment) heading = comment[1];
      const entry = /^\{ (TK_\w+), "(\w+)",/.exec(line);
      if (entry) entries.push({ token: entry[1], text: entry[2], heading, line: firstLine + index });
      else if (line.startsWith('{ TK_')) throw new Error(`expected a keyword entry, got ${line}`);
    });
  return entries;
}

/** The value types an operator takes: every type but `void`, the samplers and `struct`. */
export function valueTypes(dataTypes) {
  const names = dataTypes.map(({ name }) => name);
  return names.slice(names.indexOf('TYPE_BOOL'), names.indexOf('TYPE_MAT4') + 1);
}

/**
 * The rows of `builtin_func_defs` (`shader_language.cpp:2419`): name, return type, argument
 * types, tag and `high_end`. The heading comment above a row (`Constructors.`, `sin`, ...) is kept
 * as its group.
 */
export function builtinFunctions(cpp) {
  const start = cpp.indexOf('const ShaderLanguage::BuiltinFuncDef ShaderLanguage::builtin_func_defs[] = {');
  if (start === -1) throw new Error('expected builtin_func_defs in shader_language.cpp, found none');
  const end = cpp.indexOf('{ nullptr,', start);
  const firstLine = lineAt(cpp, start);
  const rows = [];
  let group = '';
  cpp
    .slice(start, end)
    .split('\n')
    .forEach((raw, index) => {
      const line = raw.trim();
      const comment = /^\/\/ (.+)$/.exec(line);
      if (comment) group = comment[1];
      if (!line.startsWith('{ "')) return;
      const row = /^\{ "(\w+)", (TYPE_\w+), \{ ([\w, ]+) \}, \{ [^}]* \}, (TAG_\w+), (true|false) \},$/.exec(
        line
      );
      if (!row) throw new Error(`expected a builtin_func_defs row, got ${line}`);
      const args = row[3].split(', ').filter((arg) => arg !== 'TYPE_VOID');
      rows.push({
        name: row[1],
        returns: row[2],
        args,
        tag: row[4],
        highEnd: row[5] === 'true',
        group,
        line: firstLine + index,
      });
    });
  return rows;
}

/**
 * The swizzle letter sets of each vector type, from the member switch of `_parse_expression`
 * (`shader_language.cpp:6876`): for `vec3`, `xyz`, `rgb` and `stp`.
 */
export function swizzleSets(cpp) {
  const start = cpp.indexOf('RBSet<char> position_symbols;');
  if (start === -1) throw new Error('expected the swizzle switch in shader_language.cpp, found none');
  const end = cpp.indexOf('if (mix_error) {', start);
  const body = cpp.slice(start, end);
  const blocks = [...body.matchAll(/((?:case TYPE_\w*VEC\d:\s*)+)\{([\s\S]*?)\} break;/g)];
  return blocks.flatMap((block) => {
    const types = [...block[1].matchAll(/case (TYPE_\w+):/g)].map((match) => match[1]);
    const sets = { color_symbols: '', position_symbols: '', texture_symbols: '' };
    for (const caseGroup of block[2].matchAll(/((?:case '\w':\s*)+)if \(([\s\S]*?)\{\s*mix_error/g)) {
      const letters = [...caseGroup[1].matchAll(/case '(\w)':/g)].map((match) => match[1]).join('');
      const own = Object.keys(sets).find((set) => !caseGroup[2].includes(set));
      sets[own] += letters;
    }
    const line = lineAt(cpp, start + block.index);
    return types.map((type) => ({
      type,
      sets: [sets.position_symbols, sets.color_symbols, sets.texture_symbols],
      line,
    }));
  });
}

/** The shader types of `shader_types_list` (`shader_types.cpp:523`), in order. */
export function shaderTypes(typesCpp) {
  return [...typesCpp.matchAll(/shader_types_list\.push_back\("(\w+)"\);/g)].map((match) => ({
    name: match[1],
    line: lineAt(typesCpp, match.index),
  }));
}

/** `RS::SHADER_CANVAS_ITEM` as the shading language names it: `canvas_item`. */
function shaderTypeOf(mode) {
  return mode.replace(/^RS::SHADER_/, '').toLowerCase();
}

/**
 * Each built-in variable and constant of each shader type and stage (`shader_types.cpp`): its
 * type, and whether a shader may write it.
 */
export function builtIns(typesCpp) {
  const pattern =
    /shader_modes\[(RS::SHADER_\w+)\]\.functions\["(\w+)"\]\.built_ins\["(\w+)"\] = (?:(constt|constvt)\()?ShaderLanguage::(TYPE_\w+)/g;
  const rows = [...typesCpp.matchAll(pattern)].map((match) => ({
    shaderType: shaderTypeOf(match[1]),
    stage: match[2],
    name: match[3],
    type: match[5],
    isConstant: match[4] !== undefined,
    line: lineAt(typesCpp, match.index),
  }));
  const lines = typesCpp.split('\n').filter((line) => line.includes('.built_ins['));
  if (lines.length !== rows.length) {
    throw new Error(`expected ${lines.length} built-in rows in shader_types.cpp, read ${rows.length}`);
  }
  return rows;
}

/**
 * The stage functions of each shader type and stage (`shader_types.cpp:308`), with the argument
 * and return types the `StageFunctionInfo` above each assignment holds.
 */
export function stageFunctions(typesCpp) {
  const rows = [];
  const infos = new Map();
  typesCpp.split('\n').forEach((raw, index) => {
    const line = raw.trim();
    const declared = /^ShaderLanguage::StageFunctionInfo (\w+);$/.exec(line);
    if (declared) infos.set(declared[1], { args: [], returns: null });
    const argument =
      /^(\w+)\.arguments\.push_back\(ShaderLanguage::StageFunctionInfo::Argument\("\w+", ShaderLanguage::(TYPE_\w+)\)\);$/.exec(
        line
      );
    if (argument) infos.get(argument[1]).args.push(argument[2]);
    const returns = /^(\w+)\.return_type = ShaderLanguage::(TYPE_\w+);/.exec(line);
    if (returns) infos.get(returns[1]).returns = returns[2];
    const assigned =
      /^shader_modes\[(RS::SHADER_\w+)\]\.functions\["(\w+)"\]\.stage_functions\["(\w+)"\] = (\w+);$/.exec(
        line
      );
    if (assigned) {
      const info = infos.get(assigned[4]);
      rows.push({
        shaderType: shaderTypeOf(assigned[1]),
        stage: assigned[2],
        name: assigned[3],
        args: [...info.args],
        returns: info.returns,
        line: index + 1,
      });
    } else if (line.includes('.stage_functions[')) {
      throw new Error(`expected a stage function assignment, got ${line}`);
    }
  });
  return rows;
}

/**
 * The render mode and stencil mode values of each shader type (`shader_types.cpp:233`). A mode
 * with values gives one row per value, named `<mode>_<value>` as a shader writes it.
 */
export function renderModes(typesCpp) {
  const pattern =
    /shader_modes\[(RS::SHADER_\w+)\]\.(modes|stencil_modes)\.push_back\(\{ PNAME\("(\w+)"\)(.*)\}\);/g;
  const lines = typesCpp.split('\n').filter((line) => /\.(modes|stencil_modes)\.push_back/.test(line));
  const matches = [...typesCpp.matchAll(pattern)];
  if (lines.length !== matches.length) {
    throw new Error(`expected ${lines.length} render mode rows in shader_types.cpp, read ${matches.length}`);
  }
  return matches.flatMap((match) => {
    const values = [...match[4].matchAll(/"(\w+)"/g)].map((value) => value[1]);
    const names = values.length === 0 ? [match[3]] : values.map((value) => `${match[3]}_${value}`);
    return names.map((name) => ({
      shaderType: shaderTypeOf(match[1]),
      kind: match[2] === 'modes' ? 'render_mode' : 'stencil_mode',
      name,
      line: lineAt(typesCpp, match.index),
    }));
  });
}

/**
 * The preprocessor directives `process_directive` dispatches (`shader_preprocessor.cpp:378`),
 * the `defined` operator and the pragma labels.
 */
export function preprocessorDirectives(preprocessorCpp) {
  const start = preprocessorCpp.indexOf('void ShaderPreprocessor::process_directive(');
  if (start === -1) throw new Error('expected process_directive in shader_preprocessor.cpp, found none');
  const end = preprocessorCpp.indexOf('\n}\n', start);
  const directives = [...preprocessorCpp.slice(start, end).matchAll(/directive == "(\w+)"/g)].map(
    (match) => ({
      name: `#${match[1]}`,
      line: lineAt(preprocessorCpp, start + match.index),
    })
  );
  const defined = preprocessorCpp.indexOf('find_match(result, "defined"');
  if (defined === -1) throw new Error('expected the defined operator in shader_preprocessor.cpp, found none');
  const pragmas = [...preprocessorCpp.matchAll(/label == "(\w+)"/g)].map((match) => ({
    name: `#pragma ${match[1]}`,
    line: lineAt(preprocessorCpp, match.index),
  }));
  return [...directives, { name: 'defined', line: lineAt(preprocessorCpp, defined) }, ...pragmas];
}

/** The texts of the vendored files the table reads. */
export const SOURCE_FILES = {
  header: 'shader_language.h',
  language: 'shader_language.cpp',
  types: 'shader_types.cpp',
  preprocessor: 'shader_preprocessor.cpp',
};

/** Godot's directory of each vendored file, for the citation of a row. */
const SOURCE_DIRECTORY = 'servers/rendering';

function cite(file, line) {
  return `${SOURCE_DIRECTORY}/${file}:${line}`;
}

/**
 * Every row of the instruction table, from the four source texts: `{ id, family, source }`, with
 * `returns` and `args` on the rows that have types. Ids are unique.
 */
export function instructionRows(sources) {
  const { header, language, types, preprocessor } = sources;
  const keywords = keywordList(language);
  const dataTypes = enumMembers(header, 'DataType').filter(({ name }) => name !== 'TYPE_MAX');
  const nameOf = (enumerator) => typeName(enumerator, keywords);
  const keywordRow = (family) => (entry) => ({
    id: entry.text,
    family,
    source: cite(SOURCE_FILES.language, entry.line),
    token: entry.token,
  });
  const rows = [
    // `struct` alone is the declaration keyword's row, a shader head row.
    ...dataTypes.map(({ name, line }) => ({
      id: name === 'TYPE_STRUCT' ? 'struct type' : nameOf(name),
      family: 'data type',
      source: cite(SOURCE_FILES.header, line),
      ...(name === 'TYPE_STRUCT' ? {} : { token: `TK_${name}` }),
    })),
    ...enumMembers(header, 'TokenType')
      .filter(({ name }) => /^TK_(FLOAT|INT|UINT)_CONSTANT$/.test(name))
      .map(({ name, line }) => ({
        id: `${name.replace(/^TK_|_CONSTANT$/g, '').toLowerCase()} literal`,
        family: 'literal',
        source: cite(SOURCE_FILES.header, line),
      })),
    ...keywords
      .filter((entry) => entry.heading !== 'data types')
      .map((entry) => keywordRow(keywordFamily(entry))(entry)),
    ...operatorSignatures({ header, language }, valueTypes(dataTypes)).map((signature) => ({
      id:
        signature.args.length === 0
          ? signature.op
          : `${signature.op}(${signature.args.map(nameOf).join(',')})`,
      family: 'operator',
      source: cite(SOURCE_FILES.language, signature.line),
      ...(signature.returns ? { returns: nameOf(signature.returns), args: signature.args.map(nameOf) } : {}),
    })),
    ...enumMembers(header, 'FlowOperation').map(({ name, line }) => ({
      id: name,
      family: 'statement',
      source: cite(SOURCE_FILES.header, line),
    })),
    ...builtinFunctions(language).map((row) => ({
      id: `${row.name}${row.tag === 'TAG_ARRAY' ? '[array]' : ''}(${row.args.map(nameOf).join(',')})`,
      family:
        row.group === 'Constructors.' ? 'constructor' : row.highEnd ? 'function (high_end)' : 'function',
      source: cite(SOURCE_FILES.language, row.line),
      returns: nameOf(row.returns),
      args: row.args.map(nameOf),
    })),
    ...swizzleSets(language).flatMap(({ type, sets, line }) =>
      sets.map((set) => ({
        id: `${nameOf(type)}.${set}`,
        family: 'swizzle',
        source: cite(SOURCE_FILES.language, line),
      }))
    ),
    ...shaderTypes(types).map(({ name, line }) => ({
      id: `shader_type ${name}`,
      family: 'shader head',
      source: cite(SOURCE_FILES.types, line),
    })),
    ...builtIns(types).map((row) => ({
      id: `${row.shaderType}.${row.stage}.${row.name}`,
      family: row.isConstant ? 'built-in (read only)' : 'built-in',
      source: cite(SOURCE_FILES.types, row.line),
      returns: nameOf(row.type),
    })),
    ...stageFunctions(types).map((row) => ({
      id: `${row.shaderType}.${row.stage}.${row.name}(${row.args.map(nameOf).join(',')})`,
      family: 'stage function',
      source: cite(SOURCE_FILES.types, row.line),
      returns: nameOf(row.returns),
      args: row.args.map(nameOf),
    })),
    ...renderModes(types).map((row) => ({
      id: `${row.shaderType} ${row.kind} ${row.name}`,
      family: row.kind.replace('_', ' '),
      source: cite(SOURCE_FILES.types, row.line),
    })),
    ...preprocessorDirectives(preprocessor).map(({ name, line }) => ({
      id: name,
      family: 'preprocessor',
      source: cite(SOURCE_FILES.preprocessor, line),
    })),
  ];
  assertUniqueIds(rows);
  return rows;
}

/** The family of a keyword: its heading in `keyword_list`, in the table's words. */
function keywordFamily(entry) {
  const families = {
    literals: 'literal',
    'interpolation qualifiers': 'qualifier',
    'precision modifiers': 'qualifier',
    'function specifier keywords': 'qualifier',
    'global space keywords': 'shader head',
    'uniform qualifiers': 'uniform',
    'block keywords': 'statement keyword',
    hints: 'uniform hint',
    'sampler hints': entry.token.startsWith('TK_HINT_') ? 'uniform hint' : 'sampler setting',
  };
  const family = families[entry.heading];
  if (!family) throw new Error(`expected a known keyword_list heading, got "${entry.heading}"`);
  return family;
}

function assertUniqueIds(rows) {
  const seen = new Set();
  for (const { id } of rows) {
    if (seen.has(id)) throw new Error(`expected unique instruction ids, got ${id} twice`);
    seen.add(id);
  }
}
