/**
 * The text the preprocessor makes of each probe's shader equals the text Godot's preprocessor
 * made of it, which a live run of `pnpm godot:probes` records.
 */

import { describe, expect, it } from 'vitest';
import { shaderCode } from '../../../../packages/textscene-core/src/shaders/language/parseShader.ts';
import { probeShader } from '../../../../scripts/godot-probes/probeShader.mjs';
import { godotAnswers } from '../godotAnswers.mjs';
import { probeShaderOptions } from '../integration/page/probeIncludes.mjs';
import { PROBES } from './probes.mjs';

const RECORD = godotAnswers().probes;

const preprocessed = PROBES.flatMap((probe) => {
  const text = RECORD.probes[probe.name]?.preprocessed;
  return text === undefined ? [] : [[probe.name, probe, text]];
});

describe.each(preprocessed)('probe %s', (_, probe, text) => {
  it("is preprocessed to Godot's text", () => {
    expect(shaderCode(probeShader(probe), probeShaderOptions(probe.includes))).toBe(text);
  });
});
