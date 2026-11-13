#!/usr/bin/env node
/**
 * Writes the instruction table of Godot 4.6.3's shading language from the vendored source in
 * `source/`: `pnpm godot:shader-language [--check]`. It writes the committed rows the translator
 * reads, and the readable table with each row's state. `--check` writes nothing and exits 1 on
 * a stale file. `--fetch` first downloads the vendored files again from Godot's tag.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkGenerated, writeGenerated } from '../generatedFile.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';
import { PROBES } from '../../apps/textscene-three-godot-shaders/tests/probes/probes.mjs';
import { instructionRows, SOURCE_FILES } from './readSource.mjs';
import { renderReadableTable, renderTableModule } from './renderTable.mjs';

const SOURCE_DIR = join(REPO_ROOT, 'scripts/godot-shader-language/source');
const TABLE_MODULE = join(
  REPO_ROOT,
  'packages/textscene-core/src/shaders/language/instructionTable.generated.ts'
);
const READABLE_TABLE = join(REPO_ROOT, 'apps/textscene-three-godot-shaders/INSTRUCTIONS.md');

/** The Godot tag the vendored files come from, and the directory of each in Godot's tree. */
const GODOT_TAG = '4.6.3-stable';
const GODOT_PATHS = {
  [SOURCE_FILES.header]: 'servers/rendering/shader_language.h',
  [SOURCE_FILES.language]: 'servers/rendering/shader_language.cpp',
  [SOURCE_FILES.types]: 'servers/rendering/shader_types.cpp',
  [SOURCE_FILES.preprocessor]: 'servers/rendering/shader_preprocessor.cpp',
  'LICENSE.txt': 'LICENSE.txt',
};

async function fetchSources() {
  for (const [file, path] of Object.entries(GODOT_PATHS)) {
    const url = `https://raw.githubusercontent.com/godotengine/godot/${GODOT_TAG}/${path}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`fetch ${url}: HTTP ${response.status}`);
    writeFileSync(join(SOURCE_DIR, file), await response.text());
  }
}

function readSources() {
  const read = (file) => readFileSync(join(SOURCE_DIR, file), 'utf8');
  return {
    header: read(SOURCE_FILES.header),
    language: read(SOURCE_FILES.language),
    types: read(SOURCE_FILES.types),
    preprocessor: read(SOURCE_FILES.preprocessor),
  };
}

async function main() {
  if (process.argv.includes('--fetch')) await fetchSources();
  const rows = instructionRows(readSources());
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
  await main();
}
