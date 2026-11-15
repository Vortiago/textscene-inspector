/**
 * Every probe Godot's front end refuses, the parser refuses with Godot's message, on Godot's line.
 */

import { describe, expect, it } from 'vitest';
import { parsedShader } from '../../../../packages/textscene-core/src/shaders/language/parseShader.ts';
import { ShadingLanguageError } from '../../../../packages/textscene-core/src/shaders/language/shadingLanguageError.ts';
import { godotAnswers } from '../godotAnswers.mjs';
import { probeShaderOptions } from '../integration/page/probeIncludes.mjs';
import { PROBES } from './probes.mjs';

const RECORD = godotAnswers().probes;

const refused = PROBES.flatMap((probe) => {
  const rejected = RECORD.probes[probe.name]?.rejected;
  return rejected?.stage === 'shading language' ? [[probe.name, probe, rejected]] : [];
});

/** The front end's refusal of `probe` as Godot's answers hold one, or nothing when it parses. */
function refusalOf(probe) {
  try {
    parsedShader(probe.source, probeShaderOptions(probe.includes));
    return undefined;
  } catch (error) {
    if (!(error instanceof ShadingLanguageError)) throw error;
    return { stage: 'shading language', message: error.reason, line: error.position.line };
  }
}

describe.each(refused)('probe %s', (_, probe, rejected) => {
  it("is refused with Godot's message on Godot's line", () => {
    expect(refusalOf(probe)).toEqual(rejected);
  });
});
