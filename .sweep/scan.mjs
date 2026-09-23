// Per-file prose findings for the sweep: guard violations, rot markers and comment weight.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';

// The dev-kit build keeps bundler-style imports without an extension, which Node refuses.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (!specifier.startsWith('.')) throw error;
      return next(`${specifier}.js`, context);
    }
  },
});

export const devKit = await import('../packages/textscene-dev-kit/dist/index.js');
const { commentBlocks, commentViolations, markdownViolations, tscnCommentBlocks } = devKit;

export const repoRoot = resolve(import.meta.dirname, '..');

/** The guard's own exclusions: vendored, legal and generated text. */
export const VERBATIM_PATH =
  /^scenes\/(?:demos|isometric)\/|(?:^|\/)(?:THIRD-PARTY-NOTICES|SECURITY)\.md$|\.generated\.ts$/;

/** Words that mark history, review narration or a count that rots. */
const ROT_MARKER =
  /\b(?:rounds?|review(?:ed|er|s)?|sweep|drift(?:ed|s)?|previously|used to|formerly|no longer|originally|PR|20\d\d|audit(?:ed)?|we|our|surfaced|turned up|once|~\d[\d,]*)\b/gi;

export function tracked(...patterns) {
  return execFileSync('git', ['ls-files', ...patterns], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 << 20,
  })
    .split('\n')
    .filter((path) => path !== '' && !VERBATIM_PATH.test(path));
}

export function kindOf(path) {
  if (path.endsWith('.md')) return 'md';
  if (path.endsWith('.tscn')) return 'tscn';
  if (/\.(?:ts|tsx|js|mjs|css)$/.test(path) && /^(?:packages|apps|scripts)\//.test(path)) {
    return 'code';
  }
  return undefined;
}

function blocksOf(path, source) {
  if (path.endsWith('.tscn')) return tscnCommentBlocks(source);
  return commentBlocks(source, { blockOnly: path.endsWith('.css') });
}

/** Findings of one file: guard violations, rot markers and prose lines. */
export function scanFile(path) {
  const source = readFileSync(resolve(repoRoot, path), 'utf8');
  const kind = kindOf(path);
  if (kind === 'md') {
    return {
      path,
      kind,
      violations: markdownViolations(source).length,
      rot: (source.match(ROT_MARKER) ?? []).length,
      lines: source.split('\n').length,
    };
  }
  let violations = 0;
  let rot = 0;
  let lines = 0;
  for (const block of blocksOf(path, source)) {
    violations += commentViolations(block.text).length;
    rot += (block.text.match(ROT_MARKER) ?? []).length;
    lines += block.text.split('\n').length;
  }
  return { path, kind, violations, rot, lines };
}

export function scanTree() {
  return tracked('packages', 'apps', 'scripts', '*.tscn', '*.md')
    .filter((path) => kindOf(path) !== undefined)
    .map(scanFile);
}
