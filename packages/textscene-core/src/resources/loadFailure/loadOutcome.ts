import { isGodotTextResourcePath } from '../../godot/project/resourceFormats';

export type LoadFailureCause = 'missing' | 'unparsed' | 'unimported';

export interface LoadFailure {
  readonly isFailed: true;
  /** The file, each text file through which it fails, and the file that failed first. */
  readonly chain: readonly string[];
  readonly cause: LoadFailureCause;
}

export type LoadOutcome = { readonly isFailed: false } | LoadFailure;

/** The files whose failure fails a text file, or why it gave none. */
export type FailingReads = readonly string[] | 'unparsed' | 'unread';

export interface LoadFacts {
  readonly failingReads: (path: string) => Promise<FailingReads>;
  readonly exists: (path: string) => Promise<boolean>;
  /** Whether the import sidecar of the file at `path` records a failed import. */
  readonly isImportFailed: (path: string) => Promise<boolean>;
}

/** One file of a walk: why it fails on its own, or the files whose failure fails it. */
type WalkedFile = { readonly cause: LoadFailureCause } | { readonly reads: readonly string[] };

const LOADS: LoadOutcome = Object.freeze({ isFailed: false });

/** Rejects where a file that exists could not be read, so a read error of the host is no failure. */
export async function loadOutcome(path: string, facts: LoadFacts): Promise<LoadOutcome> {
  const walked = new Map<string, WalkedFile>();
  let level = [path];
  while (level.length > 0) {
    const files = await Promise.all(level.map((file) => walkedFile(file, facts)));
    files.forEach((file, index) => walked.set(level[index]!, file));
    level = [...new Set(files.flatMap((file) => ('reads' in file ? file.reads : [])))].filter(
      (read) => !walked.has(read)
    );
  }
  return outcomeIn(walked, path, new Map(), []);
}

async function walkedFile(path: string, facts: LoadFacts): Promise<WalkedFile> {
  if (!isGodotTextResourcePath(path)) return importedFile(path, facts);
  const reads = await facts.failingReads(path);
  if (typeof reads !== 'string') return { reads };
  if (!(await facts.exists(path))) return { cause: 'missing' };
  if (reads === 'unparsed') return { cause: 'unparsed' };
  throw new Error(`read ${path}: the host lists the file but could not read it`);
}

async function importedFile(path: string, facts: LoadFacts): Promise<WalkedFile> {
  if (!(await facts.exists(path))) return { cause: 'missing' };
  return (await facts.isImportFailed(path)) ? { cause: 'unimported' } : { reads: [] };
}

// Godot refuses a cycle with its own error, which the previewer does not report, so a cycle reads as loads.
function outcomeIn(
  walked: ReadonlyMap<string, WalkedFile>,
  path: string,
  decided: Map<string, LoadOutcome>,
  stack: readonly string[]
): LoadOutcome {
  if (stack.includes(path)) return LOADS;
  const known = decided.get(path);
  if (known) return known;
  const file = walked.get(path)!;
  const outcome =
    'cause' in file ? failed(path, file.cause) : firstFailure(walked, path, file.reads, decided, stack);
  decided.set(path, outcome);
  return outcome;
}

function firstFailure(
  walked: ReadonlyMap<string, WalkedFile>,
  path: string,
  reads: readonly string[],
  decided: Map<string, LoadOutcome>,
  stack: readonly string[]
): LoadOutcome {
  for (const read of reads) {
    const outcome = outcomeIn(walked, read, decided, [...stack, path]);
    if (outcome.isFailed) return { ...outcome, chain: [path, ...outcome.chain] };
  }
  return LOADS;
}

function failed(path: string, cause: LoadFailureCause): LoadFailure {
  return { isFailed: true, chain: [path], cause };
}
