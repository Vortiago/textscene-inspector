/**
 * Reading source as TEXT, for the drift guards that assert over spelling rather
 * than over behaviour.
 *
 * Three of those guards grew the same comment skip independently
 * (`paintGroupConformance`, `painterViewConformance`, `materialProgramInputs`),
 * and a fourth was about to. They are all defending the same thing — a match
 * inside a doc comment is prose, not a use, and a scan that cannot tell the two
 * apart is either noisy or silenced — so the guard lives once.
 *
 * Test-only: the `testing/` directories under `src` are excluded from the
 * build, like `parser/testing` and `resources/testing`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface SourceFile {
  /** Absolute. */
  readonly file: string;
  readonly source: string;
}

/** Never walked: generated output and installed packages are nobody's source. */
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'build', 'coverage', '.git']);

const REPO_ROOT = join(import.meta.dirname, '../../../../..');

/** Repo-relative, so an offender reads the way it would be typed into an editor. */
export const repoPath = (file: string): string => relative(REPO_ROOT, file);

/** One of the repo's top-level source trees, absolute. */
export const repoRoot = (...segments: string[]): string => join(REPO_ROOT, ...segments);

/** A line whose match is prose. Covers a block body, a `//` line and a `/*` opener. */
export function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*');
}

/**
 * Whether the comment block immediately above line `index` carries `marker`.
 * Walks the block rather than a fixed window, so a reason worth writing down is
 * never truncated into silence.
 */
export function hasExemptionAbove(lines: string[], index: number, marker: string): boolean {
  for (let i = index - 1; i >= 0 && isCommentLine(lines[i]!); i--) {
    if (lines[i]!.includes(marker)) return true;
  }
  return false;
}

/**
 * Lines matching `pattern` in code. A trailing `//` comment is prose too, and
 * can launder nothing. Pass `marker` to allow a per-line opt-out; omit it for a
 * rule that takes none.
 */
export function offendingLines(source: string, pattern: RegExp, marker?: string): number[] {
  const lines = source.split('\n');
  const offenders: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isCommentLine(lines[i]!)) continue;
    if (!pattern.test(lines[i]!.replace(/\/\/.*$/, ''))) continue;
    // Consulted only for a line that already matched — an exemption can never
    // do anything but suppress a would-be offender.
    if (marker !== undefined && hasExemptionAbove(lines, i, marker)) continue;
    offenders.push(i + 1);
  }
  return offenders;
}

/** Every file under `roots` whose NAME `accept` takes, walked recursively. */
export function walkSources(roots: readonly string[], accept: (name: string) => boolean): SourceFile[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) walk(path);
      } else if (accept(entry.name)) found.push(path);
    }
  };
  for (const root of roots) walk(root);
  return found.map((file) => ({ file, source: readFileSync(file, 'utf8') }));
}

/** `.ts`/`.tsx` that is not a test — the shape every guard here scans. */
export const isProductionSource = (name: string): boolean =>
  /\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name);

/** `path:line` per offence, ready to name in a failure message. */
export function reportOffenders(
  sources: readonly SourceFile[],
  scan: (source: string) => number[]
): string[] {
  return sources.flatMap(({ file, source }) => scan(source).map((line) => `${repoPath(file)}:${line}`));
}
