#!/usr/bin/env node
/**
 * Runs every probe in Godot 4.6.3 and writes Godot's answers to the checked-in record:
 * `pnpm godot:probes [--check]`. `--check` writes nothing and exits 1 when a new run differs from
 * the record. It needs `godot` on the path and `xvfb-run`, and renders on lavapipe as
 * `pnpm ref:godot` does. The CI image has both, so the "Shader package" job runs `--check`.
 */

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROBES } from '../../apps/textscene-three-godot-shaders/tests/probes/probes.mjs';
import { checkGenerated, writeGenerated } from '../generatedFile.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';
import {
  MAIN_SCENE,
  MAIN_SCRIPT,
  PROJECT_GODOT,
  parseProbeOutput,
  probeData,
  probeShaderFiles,
} from './godotProject.mjs';
import { runGodotProject } from './godotRun.mjs';
import { renderRecord } from './record.mjs';

const RECORD = join(REPO_ROOT, 'apps/textscene-three-godot-shaders/tests/probes/godot-record.json');

/** The only Godot release the record may come from: the translator follows its source. */
const GODOT_VERSION = '4.6.3';

function projectFiles() {
  return {
    'project.godot': PROJECT_GODOT,
    'main.tscn': MAIN_SCENE,
    'main.gd': MAIN_SCRIPT,
    'probes.json': JSON.stringify(probeData(PROBES)),
    ...probeShaderFiles(PROBES),
  };
}

function main() {
  const output = parseProbeOutput(runGodotProject(projectFiles()));
  if (!output.godot.startsWith(`${GODOT_VERSION}-stable`)) {
    throw new Error(`expected Godot ${GODOT_VERSION}, got ${output.godot}`);
  }
  const outputs = [[RECORD, renderRecord(output, PROBES)]];
  const options = { tool: 'godot-probes', summary: `${PROBES.length} probes` };
  if (process.argv.includes('--check')) checkGenerated(outputs, { ...options, command: 'pnpm godot:probes' });
  else writeGenerated(outputs, options);
}

// `pathToFileURL`, not a `file://` template: on Windows `process.argv[1]` is a `C:\...` path.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
