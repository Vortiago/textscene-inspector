/**
 * Every probe Godot's front end refuses, the parser refuses with Godot's message, on Godot's line.
 */

import { describe, expect, it } from 'vitest';
import { parse } from '../../../../packages/textscene-core/src/shaders/language/parse.ts';
import { ShadingLanguageError } from '../../../../packages/textscene-core/src/shaders/language/shadingLanguageError.ts';
import { tokenize } from '../../../../packages/textscene-core/src/shaders/language/tokenizer.ts';
import { PROBES } from './probes.mjs';

const RECORD = (await import('./godot-record.json', { with: { type: 'json' } })).default;

const refused = PROBES.flatMap((probe) => {
  const rejected = RECORD.probes[probe.name]?.rejected;
  return rejected?.stage === 'shading language' ? [[probe.name, probe.source, rejected]] : [];
});

/** The parser's refusal of `source` as Godot's record holds one, or nothing when it parses. */
function refusalOf(source) {
  try {
    parse(tokenize(source));
    return undefined;
  } catch (error) {
    if (!(error instanceof ShadingLanguageError)) throw error;
    return { stage: 'shading language', message: error.reason, line: error.position.line };
  }
}

describe.each(refused)('probe %s', (_, source, rejected) => {
  it("is refused with Godot's message on Godot's line", () => {
    expect(refusalOf(source)).toEqual(rejected);
  });
});
