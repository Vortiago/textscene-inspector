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

const USAGE = `pnpm comments:check [--base <rev>] | --all
  --base <rev>  check the comments added or changed since <rev>, default the merge base with origin/main
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

/** The added lines of each file since `base`, with untracked files added whole. */
function changedSince(base) {
  const diff = git(
    '-c',
    'core.quotePath=false',
    'diff',
    '--unified=0',
    '--find-renames',
    ...PLAIN_DIFF,
    base
  );
  const untracked = git('ls-files', '--others', '--exclude-standard', '--exclude-from=.prettierignore')
    .split('\n')
    .filter(Boolean);
  return [...linesByPath(diff), ...wholeFiles(untracked)];
}

/** A tracked file deleted in the working tree has no text to read. */
function everyFile() {
  const tracked = git('-c', 'core.quotePath=false', 'ls-files').split('\n');
  return wholeFiles(tracked.filter((path) => existsSync(join(REPO_ROOT, path))));
}

function findingsIn(files) {
  const ignored = ignoredPaths();
  return files
    .filter(([path]) => isCheckedSource(path) && !ignored.has(path))
    .flatMap(([path, added]) =>
      touchedFindings(readFileSync(join(REPO_ROOT, path), 'utf8'), path, added, prettierConfig.printWidth)
    );
}

function reportDebt() {
  const findings = findingsIn(everyFile());
  const byRule = Object.groupBy(findings, (finding) => finding.rule);
  for (const [rule, list] of Object.entries(byRule)) console.log(`${rule}: ${list.length}`);
  console.log(
    `comments:check: ${findings.length} findings in ${new Set(findings.map((f) => f.path)).size} files`
  );
}

function checkChanges(base) {
  const findings = findingsIn(changedSince(base));
  for (const { path, line, rule, message } of findings) console.log(`${path}:${line} ${rule}: ${message}`);
  if (findings.length === 0) {
    console.log(`comments:check: every comment added since ${base.slice(0, 12)} keeps the rules.`);
    return 0;
  }
  console.log(`comments:check: ${findings.length} comments break the rules in AGENTS.md "Comments".`);
  return 1;
}

function readOptions() {
  try {
    return parseArgs({
      options: { base: { type: 'string' }, all: { type: 'boolean' }, help: { type: 'boolean' } },
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
  const base = options.base ?? mergeBaseWithMain('HEAD');
  if (base === undefined) {
    console.error(`comments:check: no origin/main in this clone, so pass --base.\n${USAGE}`);
    process.exitCode = 2;
  } else {
    process.exitCode = checkChanges(base);
  }
}
