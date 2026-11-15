/** Whether a file loads in Godot, or the chain of files down to the one that fails it. */

import { isGodotTextResourcePath } from '../../godot/project/resourceFormats';

export type LoadOutcome =
  | { readonly isFailed: false }
  | {
      readonly isFailed: true;
      /** The file, each text file through which it fails, and the file that failed first. */
      readonly chain: readonly string[];
      readonly cause: 'missing' | 'unparsed';
    };

export interface LoadFacts {
  /** The files whose failure fails the text file at `path`, or null where it is missing or does not parse. */
  readonly failingReads: (path: string) => Promise<readonly string[] | null>;
  readonly exists: (path: string) => Promise<boolean>;
}

export const LOADS: LoadOutcome = Object.freeze({ isFailed: false });

export async function loadOutcome(
  path: string,
  facts: LoadFacts,
  stack: readonly string[] = []
): Promise<LoadOutcome> {
  // Godot refuses a cycle with its own error, which the previewer does not report.
  if (stack.includes(path)) return LOADS;
  if (!isGodotTextResourcePath(path)) return (await facts.exists(path)) ? LOADS : failed(path, 'missing');
  const reads = await facts.failingReads(path);
  if (reads === null) return failed(path, (await facts.exists(path)) ? 'unparsed' : 'missing');
  const outcomes = await Promise.all(reads.map((read) => loadOutcome(read, facts, [...stack, path])));
  const failure = outcomes.find((outcome) => outcome.isFailed);
  return failure?.isFailed ? { ...failure, chain: [path, ...failure.chain] } : LOADS;
}

function failed(path: string, cause: 'missing' | 'unparsed'): LoadOutcome {
  return { isFailed: true, chain: [path], cause };
}
