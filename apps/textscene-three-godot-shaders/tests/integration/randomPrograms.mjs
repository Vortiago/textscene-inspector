import { recordEntry } from '../../../../scripts/godot-probes/record.mjs';
import { runProbesInGodot } from '../../../../scripts/godot-probes/godotProject.mjs';
import { KNOWN_PROGRAMS } from '../random/knownDifferences.mjs';
import { reduceProgram } from '../random/reduce.mjs';
import { compareProbe, isFloatResult } from './compare.mjs';
import { runOnPage } from './pageRun.mjs';

/** A transpiler refusal fails here: the generator uses transpiled rows only. */
export async function compareRandomPrograms(page, programs, entries) {
  const results = [];
  for (const program of programs) {
    const actual = await runOnPage(page, program);
    const verdict = compareProbe(entries[program.name], actual, isFloatResult(program));
    const isNew = differsInBits(verdict) && !KNOWN_PROGRAMS.has(program.name);
    const reduced = isNew ? await reduceAgainstGodot(page, program) : undefined;
    results.push({ program, verdict, isRefused: actual.error !== undefined, reduced });
  }
  return results;
}

/** A refusal compares no lane, so a reduction that kept it would end on another fault. */
const differsInBits = (verdict) => !verdict.passed && verdict.lanes > 0;

/** The reduction of `program` with a live Godot run per round, or nothing when Godot cannot run. */
async function reduceAgainstGodot(page, program) {
  try {
    return await reduceProgram(program, async (candidates) => {
      // One name each: Godot's output names each probe's pixels by its name.
      const named = candidates.map((candidate, index) => ({ ...candidate, name: `reduce-${index}` }));
      const { pixels } = await runProbesInGodot(named);
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

/** One line: generated, equal, different, refused, the largest difference and the known count. */
export function randomSummary(results) {
  const refused = results.filter(({ verdict, isRefused }) => isRefused && !verdict.passed).length;
  const differ = results.filter(({ verdict, isRefused }) => !isRefused && !verdict.passed);
  const known = differ.filter(({ program }) => KNOWN_PROGRAMS.has(program.name)).length;
  const equal = results.length - refused - differ.length;
  const maxUlp = Math.max(0, ...differ.map(({ verdict }) => verdict.maxUlp));
  return `${equal} of ${results.length} random programs bit-equal with Godot, NaN lanes compared as NaN: ${differ.length} differ (${known} known with an owner, largest ${maxUlp} ULP), ${refused} refused.`;
}

/** One line for each program that is not equal and not known, with its reduced program. */
export function newDifferences(results) {
  return results
    .filter(({ program, verdict }) => !verdict.passed && !KNOWN_PROGRAMS.has(program.name))
    .map(
      ({ program, verdict, reduced }) =>
        `${program.name} differs: ${verdict.detail}\n  reduced: ${(reduced ?? program).source}`
    );
}

/** A known program that equals Godot now: the case keeps its fixed case, so only `program` drops. */
export function staleKnownPrograms(results) {
  return results
    .filter(({ program, verdict }) => verdict.passed && KNOWN_PROGRAMS.has(program.name))
    .map(({ program }) => `${program.name} equals Godot now: remove it as a program of knownDifferences.mjs`);
}

/** The verdict of each fixed case of `cases` against `entries`, Godot's answers by case name. */
export async function compareKnownCases(page, cases, entries) {
  const results = [];
  for (const knownCase of cases) {
    const actual = await runOnPage(page, knownCase);
    const verdict = compareProbe(entries[knownCase.name], actual, isFloatResult(knownCase));
    results.push({ knownCase, verdict });
  }
  return results;
}

/** One line: the fixed cases, and how many still differ from Godot in their bits. */
export const knownCaseSummary = (results) =>
  `${results.filter(({ verdict }) => differsInBits(verdict)).length} of ${results.length} fixed known-difference cases still differ from Godot.`;

/** A fixed case that no longer differs in its bits leaves the list. */
export function settledKnownCases(results) {
  return results
    .filter(({ verdict }) => !differsInBits(verdict))
    .map(({ knownCase, verdict }) =>
      verdict.passed
        ? `known difference ${knownCase.difference} equals Godot now: remove it from knownDifferences.mjs`
        : `known difference ${knownCase.difference} no longer differs in its bits: ${verdict.detail}`
    );
}
