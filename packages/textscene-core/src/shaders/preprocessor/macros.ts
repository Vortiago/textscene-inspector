import { isCharSpace, isCharWord, stripEdges } from './godotString.js';
import { PreprocessorError } from './preprocessorError.js';

export interface Define {
  readonly body: string;
  readonly arguments: readonly string[];
  readonly isBuiltIn: boolean;
}

// The 51st pass fails even when it expands nothing (shader_preprocessor.cpp:1019).
const PASSES_AT_MOST = 50;

export function expandMacros(text: string, defines: ReadonlyMap<string, Define>, line: number): string {
  // `RBMap` walks its keys in order, and a define name is ASCII, so code-unit order is Godot's.
  const names = [...defines.keys()].sort();
  let expanded = text;
  for (let pass = 1; ; pass += 1) {
    let didExpand = false;
    for (const name of names) {
      const once = expandOnce(expanded, name, defines.get(name)!, line);
      if (once === undefined) continue;
      expanded = once;
      didExpand = true;
    }
    if (pass > PASSES_AT_MOST) throw new PreprocessorError('Macro expansion limit exceeded.', line);
    if (!didExpand) return expanded;
  }
}

function expandOnce(text: string, name: string, define: Define, line: number): string | undefined {
  const match = findMatch(text, name, 0);
  if (!match) return undefined;
  if (define.arguments.length === 0) {
    return `${text.slice(0, match.index)} ${concatenate(define.body)} ${text.slice(match.index + name.length)}`;
  }
  const { values, end } = argumentValues(text, match.index + name.length, line);
  if (values.length !== define.arguments.length)
    throw new PreprocessorError('Invalid macro argument count.', line);
  const body = define.arguments.reduce(
    (body, argument, index) => substitute(body, argument, values[index]!),
    define.body
  );
  return `${text.slice(0, match.index)} ${concatenate(body)} ${text.slice(end + 1)}`;
}

function argumentValues(text: string, start: number, line: number): { values: string[]; end: number } {
  const values: string[] = [];
  let argumentStart = -1;
  let argumentEnd = -1;
  let bracketsOpen = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    let isArgumentEnd = false;
    let isListEnd = false;
    if (char === '(') {
      bracketsOpen += 1;
      if (bracketsOpen === 1) {
        argumentStart = index + 1;
        argumentEnd = -1;
      }
    } else if (char === ')') {
      bracketsOpen -= 1;
      if (bracketsOpen === 0) {
        argumentEnd = index;
        isArgumentEnd = true;
        isListEnd = true;
      }
    } else if (char === ',' && bracketsOpen === 1) {
      argumentEnd = index;
      isArgumentEnd = true;
    }
    if (isArgumentEnd) {
      if (argumentStart === -1 || argumentEnd === -1)
        throw new PreprocessorError('Invalid macro argument list.', line);
      const value = stripEdges(text.slice(argumentStart, argumentEnd));
      if (value === '') throw new PreprocessorError('Invalid macro argument.', line);
      values.push(value);
      argumentStart = argumentEnd + 1;
    }
    if (isListEnd) break;
  }
  return { values, end: argumentEnd };
}

// A value that holds a later argument's name is replaced again, as in Godot.
function substitute(body: string, name: string, value: string): string {
  let from = 0;
  for (let match = findMatch(body, name, from); match; match = findMatch(body, name, from)) {
    body = body.slice(0, match.index) + value + body.slice(match.index + name.length);
    from = match.index + value.length + 1;
  }
  return body;
}

function findMatch(text: string, value: string, from: number): { index: number } | undefined {
  let index = text.indexOf(value, from);
  while (index > -1) {
    if (index > 0 && isCharWord(text[index - 1])) {
      index = text.indexOf(value, index + 1);
      continue;
    }
    if (index + value.length < text.length && isCharWord(text[index + value.length])) {
      index = text.indexOf(value, index + value.length + 1);
      continue;
    }
    return { index };
  }
  return undefined;
}

function concatenate(body: string): string {
  let start = body.indexOf('##');
  while (start > -1) {
    let end = start + 2;
    let isConcatenation = true;
    while (body[end] === '#') {
      end += 1;
      isConcatenation = false;
    }
    if (!isConcatenation) {
      start = body.indexOf('##', end);
      continue;
    }
    while (end < body.length && isCharSpace(body[end]!)) end += 1;
    while (start >= 1 && isCharSpace(body[start - 1]!)) start -= 1;
    body = body.slice(0, start) + body.slice(end);
    start = body.indexOf('##', start);
  }
  return body;
}
