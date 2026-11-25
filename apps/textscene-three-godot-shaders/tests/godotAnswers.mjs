import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalAnswers, staleFamilies } from '../../../scripts/godot-probes/answerDigest.mjs';

/** The families every live run records, each a record file. */
const FAMILIES = ['probes', 'random', 'operators', 'corpus', 'expressions', 'heads'];

/** Recorded only when an input of the material sweep changed (scripts/ci/materialScope.mjs). */
const MATERIALS = 'materials';

/** Written only by `pnpm godot:probes`, and left out of the repository. */
export const LIVE_DIR = join(import.meta.dirname, '.godot-answers');

/** Written only by `pnpm godot:probes`: Godot's version, each family's digest and the smoke subset. */
export const ANSWERS_FILE = join(import.meta.dirname, 'godot-answers.json');

/** The value of `SHADER_ANSWERS` that makes a missing live run fail, as the shader jobs of CI set. */
const LIVE_REQUIRED = 'live';

export const livePath = (family) => join(LIVE_DIR, `${family}.json`);

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** Each family's answers. Throws when `SHADER_ANSWERS=live` finds no live run, or a digest differs. */
export function godotAnswers() {
  const isLive = FAMILIES.every((family) => existsSync(livePath(family)));
  if (isLive) return { live: true, ...currentLiveAnswers() };
  if (process.env.SHADER_ANSWERS === LIVE_REQUIRED) {
    throw new Error(
      `expected Godot's live answers in ${LIVE_DIR}, found none: run \`pnpm godot:probes\` in the CI image first`
    );
  }
  const { smoke, godot, adapter } = readJson(ANSWERS_FILE);
  return smokeAnswers(smoke, godot, adapter);
}

/** The live run's answers, with smoke materials when it skipped the sweep. Throws on a stale digest. */
function currentLiveAnswers() {
  const recorded = [...FAMILIES, MATERIALS].filter((family) => existsSync(livePath(family)));
  const answers = canonicalAnswers(
    Object.fromEntries(recorded.map((family) => [family, readJson(livePath(family))]))
  );
  const committed = readJson(ANSWERS_FILE);
  const stale = staleFamilies(answers, committed);
  if (stale.length > 0) {
    throw new Error(
      `expected the live answers in ${LIVE_DIR} to match the digests of ${ANSWERS_FILE}, found ${stale.join(', ')} differ: run \`pnpm godot:probes\` again`
    );
  }
  const materials = answers.materials
    ? { live: true, ...answers.materials }
    : smokeAnswers(committed.smoke, committed.godot, committed.adapter).materials;
  return { ...answers, materials };
}

function smokeAnswers(smoke, godot, adapter) {
  return {
    live: false,
    probes: { godot, adapter, probes: smoke.probes },
    random: { godot, adapter, probes: smoke.random },
    operators: { godot, cases: smoke.operators },
    corpus: { godot, cases: smoke.corpus },
    expressions: { godot, cases: smoke.expressions },
    heads: { godot, cases: smoke.heads },
    materials: { live: false, godot, cases: smoke.materials, verdicts: smoke.materialVerdicts },
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

/** Written only by `pnpm godot:probes`: Godot's text of each material by its hash, which no digest reads. */
export const MATERIAL_TEXTS_FILE = join(LIVE_DIR, 'material-texts.json');

/** Godot's text of each material by its hash. The live run alone has them: no Godot text is committed. */
export function liveMaterialTexts() {
  if (!existsSync(MATERIAL_TEXTS_FILE)) {
    throw new Error(
      `expected Godot's material texts in ${MATERIAL_TEXTS_FILE}, found none: run \`pnpm godot:probes\``
    );
  }
  return readJson(MATERIAL_TEXTS_FILE);
}
