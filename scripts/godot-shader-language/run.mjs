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
import { renderReadableTable, renderTableModule } from './renderTable.mjs';

const TABLE_MODULE = join(
  REPO_ROOT,
  'packages/textscene-core/src/shaders/language/instructionTable.generated.ts'
);
const READABLE_TABLE = join(REPO_ROOT, 'apps/textscene-three-godot-shaders/INSTRUCTIONS.md');
const GUIDE_DIR = join(REPO_ROOT, 'apps/textscene-three-godot-shaders/guide');
const RECORD = join(REPO_ROOT, 'apps/textscene-three-godot-shaders/tests/probes/godot-record.json');

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
