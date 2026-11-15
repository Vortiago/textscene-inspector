#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import prettierConfig from '../../prettier.config.mjs';
import { git, mergeBaseWithMain } from '../githooks/changes.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';
import { addedLines } from './addedLines.mjs';
import { isCheckedSource, touchedFindings } from './touchedFindings.mjs';

const USAGE = `pnpm comments:check [--base <rev>] | --all
  --base <rev>  check the comments added or changed since <rev>, default the merge base with origin/main
  --all         count every comment that breaks a rule, the debt the check leaves standing`;

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

/** The added lines of each checked file since `base`, with untracked files added whole. */
function changedSince(base) {
  const diff = git(
    '-c',
    'core.quotePath=false',
    'diff',
    '--unified=0',
    '--find-renames',
    '--no-color',
    '--src-prefix=a/',
    '--dst-prefix=b/',
    base
  );
  const changed = [...addedLines(diff)];
  const untracked = git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean);
  return [...changed, ...untracked.map((path) => [path, 'all'])].filter(([path]) => isCheckedSource(path));
}

function everyFile() {
  return git('-c', 'core.quotePath=false', 'ls-files')
    .split('\n')
    .filter(isCheckedSource)
    .map((path) => [path, 'all']);
}

function findingsIn(files) {
  return files.flatMap(([path, added]) =>
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

if (process.argv.includes('--help')) {
  console.log(USAGE);
} else if (process.argv.includes('--all')) {
  reportDebt();
} else {
  const base = argument('--base') ?? mergeBaseWithMain('HEAD');
  if (base === undefined) {
    console.error(`comments:check: no origin/main in this clone, so pass --base.\n${USAGE}`);
    process.exitCode = 2;
  } else {
    process.exitCode = checkChanges(base);
  }
}
