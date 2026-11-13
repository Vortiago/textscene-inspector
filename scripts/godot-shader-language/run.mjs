#!/usr/bin/env node
/**
 * Writes the instruction table of Godot 4.6.3's shading language from Godot's source
 * (scripts/godotSource.mjs): `pnpm godot:shader-language [--check] [--godot-source <dir>]`. It
 * writes the committed rows the transpiler reads, the readable table with each row's state, and
 * the user guide, whose values come from Godot's probe record. `--check` writes nothing and exits
 * 1 on a stale file.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkGenerated, writeGenerated } from '../generatedFile.mjs';
import { godotSourceDir } from '../godotSource.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';
import { SHOWCASES } from '../../apps/textscene-three-godot-shaders/tests/e2e/showcases.mjs';
import { PROBES } from '../../apps/textscene-three-godot-shaders/tests/probes/probes.mjs';
import { GUIDE_CHAPTERS } from './guideChapters.mjs';
import { instructionRows, SOURCE_FILES } from './readSource.mjs';
import { renderGuide } from './renderGuide.mjs';
import { renderTestingGuide, TESTING_FILE } from './renderTestingGuide.mjs';
import { CORPUS } from '../../apps/textscene-three-godot-shaders/tests/corpus/corpus.mjs';
import { KNOWN_MISMATCHES } from '../../apps/textscene-three-godot-shaders/tests/corpus/knownMismatches.mjs';
import { OPERATOR_CASES } from '../../apps/textscene-three-godot-shaders/tests/operators/operatorCases.mjs';
import { KNOWN_DIFFERENCES } from '../../apps/textscene-three-godot-shaders/tests/random/knownDifferences.mjs';
import { TRANSPILED_ROWS } from '../../apps/textscene-three-godot-shaders/tests/random/programs.mjs';
import {
  FIXED_SEED,
  RANDOM_PROGRAMS,
} from '../../apps/textscene-three-godot-shaders/tests/random/randomSet.mjs';
import { renderReadableTable, renderTableModule } from './renderTable.mjs';

const TABLE_MODULE = join(
  REPO_ROOT,
  'packages/textscene-core/src/shaders/language/instructionTable.generated.ts'
);
const READABLE_TABLE = join(REPO_ROOT, 'apps/textscene-three-godot-shaders/INSTRUCTIONS.md');
const GUIDE_DIR = join(REPO_ROOT, 'apps/textscene-three-godot-shaders/guide');
const TESTS = join(REPO_ROOT, 'apps/textscene-three-godot-shaders/tests');
const RECORD = join(TESTS, 'probes/godot-record.json');
const readJson = (path) => JSON.parse(readFileSync(join(TESTS, path), 'utf8'));

/**
 * The chapter on the tests, from the operator and corpus records and the corpus states that
 * vitest writes.
 */
function testingChapter() {
  return renderTestingGuide({
    operators: { cases: OPERATOR_CASES, record: readJson('operators/godot-verdicts.json') },
    random: {
      programs: RANDOM_PROGRAMS,
      seed: FIXED_SEED,
      transpiledRows: TRANSPILED_ROWS.length,
      knownDifferences: KNOWN_DIFFERENCES,
    },
    corpus: {
      corpus: CORPUS,
      corpusRecord: readJson('corpus/godot-verdicts.json'),
      states: readJson('corpus/states.json'),
      knownMismatches: KNOWN_MISMATCHES,
    },
  });
}

function readSources(sourceDir) {
  const read = (file) => readFileSync(join(sourceDir, file), 'utf8');
  return {
    header: read(SOURCE_FILES.header),
    language: read(SOURCE_FILES.language),
    types: read(SOURCE_FILES.types),
    preprocessor: read(SOURCE_FILES.preprocessor),
  };
}

function main() {
  const rows = instructionRows(readSources(godotSourceDir(process.argv)));
  const record = JSON.parse(readFileSync(RECORD, 'utf8'));
  const guide = renderGuide({
    chapters: GUIDE_CHAPTERS,
    rows,
    probes: PROBES,
    record,
    showcases: SHOWCASES,
  });
  const outputs = [
    [TABLE_MODULE, renderTableModule(rows)],
    [READABLE_TABLE, renderReadableTable(rows, PROBES)],
    ...guide.map(([file, text]) => [join(GUIDE_DIR, file), text]),
    [join(GUIDE_DIR, TESTING_FILE), testingChapter()],
  ];
  const options = { tool: 'godot-shader-language', summary: `${rows.length} instructions` };
  if (process.argv.includes('--check'))
    checkGenerated(outputs, { ...options, command: 'pnpm godot:shader-language' });
  else writeGenerated(outputs, options);
}

// `pathToFileURL`, not a `file://` template: on Windows `process.argv[1]` is a `C:\...` path.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
