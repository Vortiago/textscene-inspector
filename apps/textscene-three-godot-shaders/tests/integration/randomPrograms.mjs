/**
 * The real-GL half of the random program test: each program's transpiled text on the probe page
 * against Godot's answers, bit for bit as for a probe. A program that differs is reduced against
 * a live Godot run to a small program that still differs, printed with its seed.
 */

import { recordEntry } from '../../../../scripts/godot-probes/record.mjs';
import { runProbesInGodot } from '../../../../scripts/godot-probes/godotProject.mjs';
import { KNOWN_DIFFERENCES } from '../random/knownDifferences.mjs';
import { reduceProgram } from '../random/reduce.mjs';
import { compareProbe, isFloatResult } from './compare.mjs';
import { runOnPage } from './pageRun.mjs';

/**
 * The verdict of each of `programs` against `entries`, Godot's answers by program name, with a
 * reduced program for each that differs in its bits and is not a known difference. A refusal by
 * the transpiler is a failure here: the generator uses transpiled rows only.
 */
export async function compareRandomPrograms(page, programs, entries) {
  const results = [];
  for (const program of programs) {
    const actual = await runOnPage(page, program);
    const verdict = compareProbe(entries[program.name], actual, isFloatResult(program));
    const isNew = differsInBits(verdict) && !(program.name in KNOWN_DIFFERENCES);
    const reduced = isNew ? await reduceAgainstGodot(page, program) : undefined;
    results.push({ program, verdict, isRefused: actual.error !== undefined, reduced });
  }
  return results;
}

/**
 * Whether a comparison found lanes whose bits differ. A refusal or a missing record compares no
 * lane, so a reduction that kept it would end on another fault than the one it started from.
 */
const differsInBits = (verdict) => !verdict.passed && verdict.lanes > 0;

/** The reduction of `program` with a live Godot run per round, or nothing when Godot cannot run. */
async function reduceAgainstGodot(page, program) {
  try {
    return await reduceProgram(program, async (candidates) => {
      // One name each: Godot's output names each probe's pixels by its name.
      const named = candidates.map((candidate, index) => ({ ...candidate, name: `reduce-${index}` }));
      const { pixels } = runProbesInGodot(named);
      // The reduction takes the first candidate that differs, so the page stops at it.
      const differs = named.map(() => false);
      for (const [index, candidate] of named.entries()) {
        const entry = recordEntry(candidate, pixels.get(candidate.name));
        const verdict = compareProbe(entry, await runOnPage(page, candidate), isFloatResult(candidate));
        if (differsInBits(verdict)) {
          differs[index] = true;
          break;
        }
      }
      return differs;
    });
  } catch (error) {
    // The comparison stands without a reduction: the unreduced program is printed instead.
    console.error(`[shader-random] no reduction of ${program.name}: ${error.message}`);
    return undefined;
  }
}

/**
 * One line: the programs generated, equal, different and refused, the largest difference, and
 * how many of the differences are known with an owner.
 */
export function randomSummary(results) {
  const refused = results.filter(({ verdict, isRefused }) => isRefused && !verdict.passed).length;
  const differ = results.filter(({ verdict, isRefused }) => !isRefused && !verdict.passed);
  const known = differ.filter(({ program }) => program.name in KNOWN_DIFFERENCES).length;
  const equal = results.length - refused - differ.length;
  const maxUlp = Math.max(0, ...differ.map(({ verdict }) => verdict.maxUlp));
  return `${equal} of ${results.length} random programs bit-equal with Godot: ${differ.length} differ (${known} known with an owner, largest ${maxUlp} ULP), ${refused} refused.`;
}

/** One line for each program that is not equal and not known, with its reduced program. */
export function newDifferences(results) {
  return results
    .filter(({ program, verdict }) => !verdict.passed && !(program.name in KNOWN_DIFFERENCES))
    .map(
      ({ program, verdict, reduced }) =>
        `${program.name} differs: ${verdict.detail}\n  reduced: ${(reduced ?? program).source}`
    );
}

/** One line for each known program that equals Godot now and must leave the list. */
export function staleKnownDifferences(results) {
  return results
    .filter(({ program, verdict }) => verdict.passed && program.name in KNOWN_DIFFERENCES)
    .map(({ program }) => `${program.name} equals Godot now: remove it from knownDifferences.mjs`);
}
