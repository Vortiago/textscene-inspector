#!/usr/bin/env node
/**
 * Runs every probe and the fixed-seed random programs in Godot 4.6.3 and writes Godot's answers
 * to the checked-in records, with Godot's verdict on each operator case: `pnpm godot:probes
 * [--check]`. `--check` writes nothing and exits 1 when a new run differs from a record. It needs `godot` on the path and `xvfb-run`, and renders on lavapipe as
 * `pnpm ref:godot` does. The CI image has both, so the "Shader package" job runs `--check`.
 */

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { OPERATOR_CASES } from '../../apps/textscene-three-godot-shaders/tests/operators/operatorCases.mjs';
import { PROBES } from '../../apps/textscene-three-godot-shaders/tests/probes/probes.mjs';
import { RANDOM_PROGRAMS } from '../../apps/textscene-three-godot-shaders/tests/random/randomSet.mjs';
import { checkGenerated, writeGenerated } from '../generatedFile.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';
import { runProbesInGodot } from './godotProject.mjs';
import { requireGodotVersion } from './godotRun.mjs';
import { renderRecord } from './record.mjs';
import { godotVerdicts, renderVerdictRecord } from './shaderVerdicts.mjs';

const TESTS = join(REPO_ROOT, 'apps/textscene-three-godot-shaders/tests');
const RECORD = join(TESTS, 'probes/godot-record.json');
const OPERATOR_RECORD = join(TESTS, 'operators/godot-verdicts.json');
const RANDOM_RECORD = join(TESTS, 'random/godot-record.json');

function operatorRecord() {
  const { godot, verdicts } = godotVerdicts(OPERATOR_CASES.map((test) => test.godotText));
  requireGodotVersion(godot);
  return renderVerdictRecord(
    godot,
    OPERATOR_CASES.map((test) => test.id),
    verdicts
  );
}

function main() {
  const output = runProbesInGodot([...PROBES, ...RANDOM_PROGRAMS]);
  const outputs = [
    [RECORD, renderRecord(output, PROBES)],
    [RANDOM_RECORD, renderRecord(output, RANDOM_PROGRAMS)],
    [OPERATOR_RECORD, operatorRecord()],
  ];
  const summary = `${PROBES.length} probes, ${RANDOM_PROGRAMS.length} random programs, ${OPERATOR_CASES.length} operator cases`;
  const options = { tool: 'godot-probes', summary };
  if (process.argv.includes('--check')) checkGenerated(outputs, { ...options, command: 'pnpm godot:probes' });
  else writeGenerated(outputs, options);
}

// `pathToFileURL`, not a `file://` template: on Windows `process.argv[1]` is a `C:\...` path.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
