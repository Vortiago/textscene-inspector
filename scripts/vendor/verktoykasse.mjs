#!/usr/bin/env node
/**
 * Vendored copies from Verktøykasse: the Conventional Commits skill and hooks, the Clean Code
 * and STE rules, and the STE reviewer. Each copy carries a one-line stamp with its canon path,
 * rev and the sha256 of the canon bytes, as Verktøykasse's ADR 0001 and 0005 define.
 *
 *   node scripts/vendor/verktoykasse.mjs --from <verktoykasse checkout>   re-copy and re-stamp
 *   node scripts/vendor/verktoykasse.mjs --check                          fail on a hand edit
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

/** Canon path in Verktøykasse → copy path in this repository. */
export const COPIES = {
  'conventional-commits/SKILL.md': '.claude/skills/conventional-commits/SKILL.md',
  'conventional-commits/validate.sh': '.claude/skills/conventional-commits/validate.sh',
  'conventional-commits/commit-msg.sh': '.claude/skills/conventional-commits/commit-msg.sh',
  'conventional-commits/pr-title-check.sh': '.claude/skills/conventional-commits/pr-title-check.sh',
  'conventional-commits/selftest.sh': '.claude/skills/conventional-commits/selftest.sh',
  'clean-code/clean-code-rules.md': '.claude/rules/clean-code-rules.md',
  'simplified-technical-english/ste-rules.md': '.claude/rules/ste-rules.md',
  'simplified-technical-english/ste-review.md': '.claude/agents/ste-review.md',
};

const STAMP_MARK = 'canonical source: ';
const STAMP_RE = /canonical source: (\S+)@(\S+) sha256:([0-9a-f]{64}) - vendored copy/;

/** The sha256 of text with CR removed, so the hash does not depend on the checkout's line endings. */
export function sha256OfText(text) {
  return createHash('sha256').update(text.replaceAll('\r', '')).digest('hex');
}

/** The stamp line in the comment syntax of the copy's file type. */
function stampLine(copyPath, canon, rev, sha) {
  const text = `${STAMP_MARK}${canon}@${rev} sha256:${sha} - vendored copy, do not edit here`;
  return copyPath.endsWith('.md') ? `<!-- ${text} -->` : `# ${text}`;
}

/**
 * The canon text with the stamp inserted after the lines that must stay first: a shebang, or a
 * frontmatter block that Claude Code reads.
 */
export function stamped(canonText, stamp) {
  const lines = canonText.split('\n');
  let at = 0;
  if (lines[0]?.startsWith('#!')) at = 1;
  else if (lines[0] === '---') at = lines.indexOf('---', 1) + 1;
  return [...lines.slice(0, at), stamp, ...lines.slice(at)].join('\n');
}

/** The copy's stamp fields and its text without the stamp line, or null when it has no stamp. */
export function readStamp(copyText) {
  const lines = copyText.split('\n');
  const index = lines.findIndex((line) => line.includes(STAMP_MARK));
  const match = index === -1 ? null : STAMP_RE.exec(lines[index]);
  if (!match) return null;
  const body = [...lines.slice(0, index), ...lines.slice(index + 1)].join('\n');
  return { canon: match[1], rev: match[2], sha: match[3], body };
}

function copyFrom(checkout) {
  const rev = execFileSync('git', ['-C', checkout, 'rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim();
  for (const [canon, copy] of Object.entries(COPIES)) {
    const canonPath = resolve(checkout, canon);
    const canonText = readFileSync(canonPath, 'utf8');
    const copyPath = resolve(REPO_ROOT, copy);
    mkdirSync(dirname(copyPath), { recursive: true });
    writeFileSync(copyPath, stamped(canonText, stampLine(copy, canon, rev, sha256OfText(canonText))));
    chmodSync(copyPath, statSync(canonPath).mode & 0o777);
    console.log(`copied ${canon} → ${copy}`);
  }
}

/** Each copy whose stamp is missing, names another canon, or no longer matches its own bytes. */
export function forkedCopies() {
  const problems = [];
  for (const [canon, copy] of Object.entries(COPIES)) {
    const stamp = readStamp(readFileSync(resolve(REPO_ROOT, copy), 'utf8'));
    if (!stamp) problems.push(`${copy}: no stamp`);
    else if (stamp.canon !== canon) problems.push(`${copy}: stamp names ${stamp.canon}, expected ${canon}`);
    else if (sha256OfText(stamp.body) !== stamp.sha) problems.push(`${copy}: edited here; edit ${canon} in Verktøykasse`);
  }
  return problems;
}

function main(args) {
  const from = args.indexOf('--from');
  if (from !== -1 && args[from + 1]) return copyFrom(resolve(args[from + 1]));
  if (args.includes('--check')) {
    const problems = forkedCopies();
    for (const problem of problems) console.error(problem);
    process.exitCode = problems.length > 0 ? 1 : 0;
    return;
  }
  console.error('expected --from <verktoykasse checkout> or --check');
  process.exitCode = 2;
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
