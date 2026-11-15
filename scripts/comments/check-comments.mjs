#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import prettierConfig from '../../prettier.config.mjs';
import { git, mergeBaseWithMain } from '../githooks/changes.mjs';
import { addedLines, PLAIN_DIFF } from '../gitDiff.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';
import { isCheckedSource, touchedFindings } from './touchedFindings.mjs';
import { linesAddedInEvery } from './linesAddedInEvery.mjs';

const USAGE = `pnpm comments:check [--base <rev>]... [--head <rev>] | --all
  --base <rev>  check the comments added or changed since <rev>, default the merge base with origin/main;
                given more than once, only the lines every base's diff adds
  --head <rev>  check the commits up to <rev>, not the working tree
  --all         count every comment that breaks a rule, the debt the check leaves standing`;

/** An untracked file, and every file under `--all`, is read whole. */
const wholeFiles = (paths) => paths.map((path) => [path, 'all']);

/** The paths `.prettierignore` names: vendored and generated code, which its owner's tool writes. */
function ignoredPaths() {
  return new Set(git('ls-files', '-c', '-i', '--exclude-from=.prettierignore').split('\n'));
}

function linesByPath(diff) {
  const byPath = new Map();
  for (const { path, line } of addedLines(diff)) byPath.set(path, (byPath.get(path) ?? new Set()).add(line));
  return [...byPath];
}

function diffLines(...revisions) {
  const diff = git(
    '-c',
    'core.quotePath=false',
    'diff',
    '--unified=0',
    '--find-renames',
    ...PLAIN_DIFF,
    ...revisions
  );
  return linesByPath(diff);
}

const readFromDisk = (path) => readFileSync(join(REPO_ROOT, path), 'utf8');

/** The working tree since `bases`: what `pnpm check` checks before a commit, untracked files whole. */
function workingTreeSince(bases) {
  const untracked = git('ls-files', '--others', '--exclude-standard', '--exclude-from=.prettierignore')
    .split('\n')
    .filter(Boolean);
  const files = linesAddedInEvery(bases.map((base) => diffLines(base)));
  return { files: [...files, ...wholeFiles(untracked)], read: readFromDisk };
}

/** The commits from `bases` to `head`: what a push carries, whatever the working tree holds. */
function commitsBetween(bases, head) {
  const files = linesAddedInEvery(bases.map((base) => diffLines(base, head)));
  return { files, read: (path) => git('show', `${head}:${path}`) };
}

/** A tracked file deleted in the working tree has no text to read. */
function everyFile() {
  const tracked = git('-c', 'core.quotePath=false', 'ls-files').split('\n');
  return {
    files: wholeFiles(tracked.filter((path) => existsSync(join(REPO_ROOT, path)))),
    read: readFromDisk,
  };
}

function findingsIn({ files, read }) {
  const ignored = ignoredPaths();
  return files
    .filter(([path]) => isCheckedSource(path) && !ignored.has(path))
    .flatMap(([path, added]) => touchedFindings(read(path), path, added, prettierConfig.printWidth));
}

function reportDebt() {
  const findings = findingsIn(everyFile());
  const byRule = Object.groupBy(findings, (finding) => finding.rule);
  for (const [rule, list] of Object.entries(byRule)) console.log(`${rule}: ${list.length}`);
  console.log(
    `comments:check: ${findings.length} findings in ${new Set(findings.map((f) => f.path)).size} files`
  );
}

function checkChanges(bases, head) {
  const findings = findingsIn(head === undefined ? workingTreeSince(bases) : commitsBetween(bases, head));
  for (const { path, line, rule, message } of findings) console.log(`${path}:${line} ${rule}: ${message}`);
  if (findings.length === 0) {
    const since = bases.map((base) => base.slice(0, 12)).join(' and ');
    console.log(`comments:check: every comment added since ${since} keeps the rules.`);
    return 0;
  }
  console.log(`comments:check: ${findings.length} comments break the rules in AGENTS.md "Comments".`);
  return 1;
}

function readOptions() {
  try {
    return parseArgs({
      options: {
        base: { type: 'string', multiple: true },
        head: { type: 'string' },
        all: { type: 'boolean' },
        help: { type: 'boolean' },
      },
    }).values;
  } catch (error) {
    console.error(`comments:check: ${error.message}\n${USAGE}`);
    process.exit(2);
  }
}

const options = readOptions();

if (options.help) {
  console.log(USAGE);
} else if (options.all) {
  reportDebt();
} else {
  const bases = options.base ?? [mergeBaseWithMain('HEAD')].filter(Boolean);
  if (bases.length === 0) {
    console.error(`comments:check: no origin/main in this clone, so pass --base.\n${USAGE}`);
    process.exitCode = 2;
  } else {
    process.exitCode = checkChanges(bases, options.head);
  }
}
