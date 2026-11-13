#!/usr/bin/env node
/**
 * Writes the instruction table of Godot 4.6.3's shading language from Godot's source
 * (scripts/godotSource.mjs): `pnpm godot:shader-language [--check] [--godot-source <dir>]`. It
 * writes the committed rows the translator reads, and the readable table with each row's state.
 * `--check` writes nothing and exits 1 on a stale file.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkGenerated, writeGenerated } from '../generatedFile.mjs';
import { godotSourceDir } from '../godotSource.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';
import { PROBES } from '../../apps/textscene-three-godot-shaders/tests/probes/probes.mjs';
import { instructionRows, SOURCE_FILES } from './readSource.mjs';
import { renderReadableTable, renderTableModule } from './renderTable.mjs';

const TABLE_MODULE = join(
  REPO_ROOT,
  'packages/textscene-core/src/shaders/language/instructionTable.generated.ts'
);
const READABLE_TABLE = join(REPO_ROOT, 'apps/textscene-three-godot-shaders/INSTRUCTIONS.md');

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
  const outputs = [
    [TABLE_MODULE, renderTableModule(rows)],
    [READABLE_TABLE, renderReadableTable(rows, PROBES)],
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
