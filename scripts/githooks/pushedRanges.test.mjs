import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { pushedRanges } from './pushedRanges.mjs';

const NO_SHA = '0'.repeat(40);
const repos = [];

/** A repository in a temporary folder, with `git` bound to it. */
function repository() {
  const dir = mkdtempSync(join(tmpdir(), 'pushed-ranges-'));
  repos.push(dir);
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  const commit = (file) => {
    writeFileSync(join(dir, file), file);
    git('add', file);
    git('commit', '-q', '-m', file);
    return git('rev-parse', 'HEAD');
  };
  return { git, commit };
}

/** A branch pushed at `pushedTip`, which then merged a main that moved on to `mainTip`. */
function branchThatMergedMain() {
  const { git, commit } = repository();
  commit('base.ts');
  git('checkout', '-q', '-b', 'topic');
  const pushedTip = commit('topic.ts');
  git('checkout', '-q', 'main');
  const mainTip = commit('main.ts');
  git('update-ref', 'refs/remotes/origin/main', mainTip);
  git('checkout', '-q', 'topic');
  git('merge', '-q', '--no-edit', 'main');
  return { git, pushedTip, mainTip, localTip: git('rev-parse', 'HEAD') };
}

afterEach(() => {
  for (const dir of repos.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('pushedRanges', () => {
  it('checks a branch that merged main against its pushed tip and against where it left main', () => {
    const { git, pushedTip, mainTip, localTip } = branchThatMergedMain();

    const ranges = pushedRanges(`refs/heads/topic ${localTip} refs/heads/topic ${pushedTip}\n`, git);

    expect(ranges.pushed).toEqual([{ bases: [pushedTip, mainTip], head: localTip }]);
  });

  it('keeps the changed files of the push itself, which pick the checks', () => {
    const { git, pushedTip, localTip } = branchThatMergedMain();

    const ranges = pushedRanges(`refs/heads/topic ${localTip} refs/heads/topic ${pushedTip}\n`, git);

    expect(ranges.changed).toEqual(['main.ts']);
  });

  it('checks a new branch from where it left main (edge case)', () => {
    const { git, mainTip, localTip } = branchThatMergedMain();

    const ranges = pushedRanges(`refs/heads/topic ${localTip} refs/heads/topic ${NO_SHA}\n`, git);

    expect(ranges.pushed).toEqual([{ bases: [mainTip], head: localTip }]);
  });

  it('checks from the pushed tip in a clone with no origin/main (edge case)', () => {
    const { git, pushedTip, localTip } = branchThatMergedMain();
    git('update-ref', '-d', 'refs/remotes/origin/main');

    const ranges = pushedRanges(`refs/heads/topic ${localTip} refs/heads/topic ${pushedTip}\n`, git);

    expect(ranges.pushed).toEqual([{ bases: [pushedTip], head: localTip }]);
  });

  it('is undefined for a new branch in a clone with no origin/main (error case)', () => {
    const { git, localTip } = branchThatMergedMain();
    git('update-ref', '-d', 'refs/remotes/origin/main');

    expect(pushedRanges(`refs/heads/topic ${localTip} refs/heads/topic ${NO_SHA}\n`, git)).toBeUndefined();
  });

  it('skips a deleted ref (edge case)', () => {
    const { git, pushedTip } = branchThatMergedMain();

    expect(pushedRanges(`(delete) ${NO_SHA} refs/heads/topic ${pushedTip}\n`, git)).toEqual({
      changed: [],
      deleted: [],
      pushed: [],
    });
  });
});
