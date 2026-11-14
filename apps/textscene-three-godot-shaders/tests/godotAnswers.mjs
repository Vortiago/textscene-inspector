/**
 * Godot's answers to the probes, the random programs, the operator cases and the corpus, for the
 * tests that compare with them. `pnpm godot:probes` asks Godot live and writes every answer to
 * the ignored `.godot-answers/`. The committed `godot-answers.json` holds a digest of each family
 * and a smoke subset, so a test outside the CI image still compares some cases with Godot.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalAnswers, staleFamilies } from '../../../scripts/godot-probes/answerDigest.mjs';

/** The families of answers, each a record file of the live run. */
const FAMILIES = ['probes', 'random', 'operators', 'corpus'];

/** Written only by `pnpm godot:probes`, and left out of the repository. */
export const LIVE_DIR = join(import.meta.dirname, '.godot-answers');

/** Written only by `pnpm godot:probes`: Godot's version, each family's digest and the smoke subset. */
export const ANSWERS_FILE = join(import.meta.dirname, 'godot-answers.json');

/** The value of `GODOT_ANSWERS` that makes a missing live run fail, as the Shader package job sets. */
const LIVE_REQUIRED = 'live';

export const livePath = (family) => join(LIVE_DIR, `${family}.json`);

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/**
 * Every family's answers, `{ live, probes, random, operators, corpus }`, each in its record
 * shape and the same on every CPU (`canonicalAnswers`). `live` is false when no live run exists,
 * and each family then holds the smoke subset only: a test that needs every case runs when `live`
 * is true. Throws without a live run when `GODOT_ANSWERS` is `live`, so a job without Godot fails
 * instead of passing on the subset, and throws on a live run the committed digests do not match.
 */
export function godotAnswers() {
  const isLive = FAMILIES.every((family) => existsSync(livePath(family)));
  if (isLive) return { live: true, ...currentLiveAnswers() };
  if (process.env.GODOT_ANSWERS === LIVE_REQUIRED) {
    throw new Error(
      `expected Godot's live answers in ${LIVE_DIR}, found none: run \`pnpm godot:probes\` in the CI image first`
    );
  }
  const { smoke, godot, adapter } = readJson(ANSWERS_FILE);
  return smokeAnswers(smoke, godot, adapter);
}

/** The live run's answers. Throws when a family's digest is not the committed one: the run is stale. */
function currentLiveAnswers() {
  const answers = canonicalAnswers(
    Object.fromEntries(FAMILIES.map((family) => [family, readJson(livePath(family))]))
  );
  const stale = staleFamilies(answers, readJson(ANSWERS_FILE));
  if (stale.length > 0) {
    throw new Error(
      `expected the live answers in ${LIVE_DIR} to match the digests of ${ANSWERS_FILE}, found ${stale.join(', ')} differ: run \`pnpm godot:probes\` again`
    );
  }
  return answers;
}

function smokeAnswers(smoke, godot, adapter) {
  return {
    live: false,
    probes: { godot, adapter, probes: smoke.probes },
    random: { godot, adapter, probes: smoke.random },
    operators: { godot, cases: smoke.operators },
    corpus: { godot, cases: smoke.corpus },
  };
}

/** Godot's live answers, for a reader that needs every case. Throws on the smoke subset. */
export function liveGodotAnswers() {
  const answers = godotAnswers();
  if (!answers.live) {
    throw new Error(
      `expected Godot's live answers in ${LIVE_DIR}, found the smoke subset only: run \`pnpm godot:probes\` first`
    );
  }
  return answers;
}
