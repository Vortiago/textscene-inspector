/**
 * The committed trace of a live Godot run: Godot's version and adapter, a digest of each family
 * of answers, and the smoke subset that the tests outside the CI image compare with. A change of
 * Godot, Mesa or LLVM changes a digest, so it shows in review as a change of this file.
 */

import { createHash } from 'node:crypto';
import { isNaNBits, returnsFloat } from './laneAgreement.mjs';

/**
 * A case is in the smoke subset when the first byte of the SHA-256 of its id is below this, about
 * one case in 32. The rule reads the id alone, so a new case leaves the others where they are.
 */
const SMOKE_BYTE_BELOW = 8;

/**
 * The bits every NaN of a float lane takes for every reader: GLSL ES 3.00 section 4.5.1 leaves a
 * NaN's bits to the device, and lavapipe's differ by CPU.
 */
const CANONICAL_NAN = '7fc00000';

const sha256 = (text) => createHash('sha256').update(text).digest();

export const isSmokeId = (id) => sha256(id)[0] < SMOKE_BYTE_BELOW;

const isNaNLane = (lane) => isNaNBits(Number.parseInt(lane, 16));

/** `entry` with each NaN lane of a float result as one value. */
function canonicalEntry(entry) {
  if (entry.results === undefined || !returnsFloat(entry.source)) return entry;
  return {
    ...entry,
    results: entry.results.map((row) => row.map((lane) => (isNaNLane(lane) ? CANONICAL_NAN : lane))),
  };
}

/** The SHA-256 of a family's answers, `{ id: answer }`. */
const familyDigest = (answers) => sha256(JSON.stringify(Object.entries(answers))).toString('hex');

const smokeOf = (answers) => Object.fromEntries(Object.entries(answers).filter(([id]) => isSmokeId(id)));

const canonicalProbes = (record) => ({
  ...record,
  adapter: adapterWithoutWidth(record.adapter),
  probes: Object.fromEntries(
    Object.entries(record.probes).map(([name, entry]) => [name, canonicalEntry(entry)])
  ),
});

/** `llvmpipe (LLVM 20.1.2, 256 bits)` as `llvmpipe (LLVM 20.1.2)`: lavapipe names the CPU's vector width. */
const adapterWithoutWidth = (adapter) => adapter.replace(/, \d+ bits\)$/, ')');

/**
 * The records of one live run as every reader sees them, the same on every CPU: each NaN lane of
 * a float result as one value, and the adapter without its vector width.
 */
export function canonicalAnswers({ probes, random, operators, corpus }) {
  return { probes: canonicalProbes(probes), random: canonicalProbes(random), operators, corpus };
}

/** Each family's answers, `{ id: answer }`: probes and random by name, operators and corpus by id. */
const familiesOf = ({ probes, random, operators, corpus }) => ({
  probes: probes.probes,
  random: random.probes,
  operators: operators.cases,
  corpus: corpus.cases,
});

/** The families of canonical `answers` whose digest is not the one `committed` holds. */
export function staleFamilies(answers, committed) {
  return Object.entries(familiesOf(answers))
    .filter(([family, entries]) => familyDigest(entries) !== committed.digests[family])
    .map(([family]) => family);
}

/** The JSON text of `answers`, with each answer on one line so the file stays short. */
function renderEntries(answers) {
  const indent = '  ';
  const lines = Object.entries(answers).map(
    ([id, answer]) => `${indent} ${JSON.stringify(id)}: ${JSON.stringify(answer)}`
  );
  return lines.length === 0 ? '{}' : `{\n${lines.join(',\n')}\n${indent}}`;
}

/**
 * The text of the committed answers file, from the live records of one run: `probes` and
 * `random` keyed by probe name, `operators` and `corpus` by case id.
 */
export function renderAnswersFile(records) {
  const answers = canonicalAnswers(records);
  const families = familiesOf(answers);
  const digests = Object.fromEntries(
    Object.entries(families).map(([family, entries]) => [family, familyDigest(entries)])
  );
  const smoke = Object.entries(families).map(
    ([family, entries]) => `  ${JSON.stringify(family)}: ${renderEntries(smokeOf(entries))}`
  );
  return [
    '{',
    ` "godot": ${JSON.stringify(answers.probes.godot)},`,
    ` "adapter": ${JSON.stringify(answers.probes.adapter)},`,
    ` "digests": ${JSON.stringify(digests, null, 1).replace(/\n/g, '\n ')},`,
    ` "smoke": {\n${smoke.join(',\n')}\n }`,
    '}',
    '',
  ].join('\n');
}
