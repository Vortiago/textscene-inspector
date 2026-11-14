/**
 * The one rule by which a result lane agrees with Godot's: its bits equal Godot's, or, in a float
 * lane, both are NaN. GLSL ES 3.00 section 4.5.1 leaves a NaN's sign and payload to the device,
 * and lavapipe gives a NaN another sign on an AVX-512 CPU than on an AVX2 one.
 */

import { PROBE_TYPES, probeSignature } from './probeShader.mjs';

/** Whether the probe of `source` returns floats, whose NaN lanes agree whatever their bits. */
export const returnsFloat = (source) => PROBE_TYPES[probeSignature(source).returns].scalar === 'float';

const isNaNBits = (bits) => (bits & 0x7f800000) === 0x7f800000 && (bits & 0x7fffff) !== 0;

/** Whether lane bits `got` agree with Godot's `want`. An int, uint or bool lane agrees bit for bit. */
export const lanesAgree = (want, got, isFloat) =>
  want === got || (isFloat && isNaNBits(want) && isNaNBits(got));

/**
 * The record text of this run, `runText`, with each probe entry that agrees with its entry in
 * `recordedText` kept as recorded, so a run on another CPU leaves Godot's recorded bits alone.
 * Nothing for `recordedText` means no record yet.
 */
export function recordKeepingAgreeingEntries(recordedText, runText) {
  if (recordedText === undefined) return runText;
  const recorded = JSON.parse(recordedText).probes;
  const run = JSON.parse(runText);
  const probes = Object.fromEntries(
    Object.entries(run.probes).map(([name, entry]) => [
      name,
      recorded[name] && entriesAgree(recorded[name], entry) ? recorded[name] : entry,
    ])
  );
  return `${JSON.stringify({ ...run, probes }, null, 1)}\n`;
}

function entriesAgree(recorded, run) {
  const { results: recordedResults, ...recordedRest } = recorded;
  const { results: runResults, ...runRest } = run;
  if (JSON.stringify(recordedRest) !== JSON.stringify(runRest)) return false;
  if (recordedResults === undefined || runResults === undefined) return recordedResults === runResults;
  const want = recordedResults.flat();
  const got = runResults.flat();
  const isFloat = returnsFloat(run.source);
  return (
    want.length === got.length &&
    want.every((lane, index) =>
      lanesAgree(Number.parseInt(lane, 16), Number.parseInt(got[index], 16), isFloat)
    )
  );
}
