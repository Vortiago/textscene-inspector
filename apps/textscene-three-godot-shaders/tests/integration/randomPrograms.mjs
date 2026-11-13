/**
 * The real-GL half of the random program test: each program's translation on the probe page
 * against Godot's answers, bit for bit as for a probe. A program that differs is reduced against
 * a live Godot run to a small program that still differs, printed with its seed.
 */

import { recordEntry } from '../../../../scripts/godot-probes/record.mjs';
import { runProbesInGodot } from '../../../../scripts/godot-probes/godotProject.mjs';
import { reduceProgram } from '../random/reduce.mjs';
import { compareProbe } from './compare.mjs';
import { runOnPage } from './pageRun.mjs';

/**
 * The verdict of each of `programs` against `entries`, Godot's answers by program name, with a
 * reduced program for each that differs. A refusal by the transpiler is a failure here: the
 * generator uses translated rows only.
 */
export async function compareRandomPrograms(page, programs, entries) {
  const results = [];
  for (const program of programs) {
    const verdict = compareProbe(entries[program.name], await runOnPage(page, program));
    const reduced = verdict.passed ? undefined : await reduceAgainstGodot(page, program);
    results.push({ program, verdict, reduced });
  }
  return results;
}

/** The reduction of `program` with a live Godot run per round, or nothing when Godot cannot run. */
async function reduceAgainstGodot(page, program) {
  try {
    return await reduceProgram(program, async (candidates) => {
      const { pixels } = runProbesInGodot(candidates);
      const differs = [];
      for (const candidate of candidates) {
        const entry = recordEntry(candidate, pixels.get(candidate.name));
        differs.push(!compareProbe(entry, await runOnPage(page, candidate)).passed);
      }
      return differs;
    });
  } catch (error) {
    // The comparison stands without a reduction: the unreduced program is printed instead.
    console.error(`[shader-random] no reduction of ${program.name}: ${error.message}`);
    return undefined;
  }
}

/** One line: the programs generated, equal, different and refused, and the largest difference. */
export function randomSummary(results) {
  const refused = results.filter(({ verdict }) => verdict.lanes === 0 && !verdict.passed).length;
  const differ = results.filter(({ verdict }) => verdict.lanes > 0 && !verdict.passed);
  const equal = results.length - refused - differ.length;
  const maxUlp = Math.max(0, ...differ.map(({ verdict }) => verdict.maxUlp));
  return `${results.length} random programs against Godot: ${equal} equal bit for bit, ${differ.length} differ (largest ${maxUlp} ULP), ${refused} refused.`;
}

/** One line per program that is not equal: its name, the reduced program and the detail. */
export function randomFailures(results) {
  return results
    .filter(({ verdict }) => !verdict.passed)
    .map(({ program, verdict, reduced }) => {
      const smallest = reduced ?? program;
      return `${program.name} differs: ${verdict.detail}\n  reduced: ${smallest.source}`;
    });
}
