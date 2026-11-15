import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { pushedRanges } from './pushedRanges.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';

const CHECK_COMMENTS = join(REPO_ROOT, 'scripts/comments/check-comments.mjs');
/** A file whose comment breaks the one-line rule. */
const TWO_LINE_COMMENT = 'export const a = 1;\n// one\n// two\nexport const b = 2;\n';

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
  writeFileSync(join(dir, '.prettierignore'), '');
  const commit = (file, text = `export const name = '${file}';\n`) => {
    writeFileSync(join(dir, file), text);
    git('add', '.');
    git('commit', '-q', '-m', file);
    return git('rev-parse', 'HEAD');
  };
  /** The exit status of `comments:check` over the push the hook reads from `stdin`: 1 is a finding. */
  const commentsStatus = (stdin) => {
    const [{ bases, head }] = pushedRanges(stdin, git).pushed;
    const args = [CHECK_COMMENTS, ...bases.flatMap((base) => ['--base', base]), '--head', head];
    return spawnSync('node', args, { cwd: dir, encoding: 'utf8' }).status;
  };
  return { dir, git, commit, commentsStatus };
}

/** A branch pushed at `pushedTip`, which then merged a main that moved on to `mainTip`. */
function branchThatMergedMain(mainText) {
  const { dir, git, commit, commentsStatus } = repository();
  commit('base.ts');
  git('checkout', '-q', '-b', 'topic');
  const pushedTip = commit('topic.ts');
  git('checkout', '-q', 'main');
  const mainTip = commit('main.ts', mainText);
  git('update-ref', 'refs/remotes/origin/main', mainTip);
  git('checkout', '-q', 'topic');
  git('merge', '-q', '--no-edit', 'main');
  return { dir, git, commit, commentsStatus, pushedTip, mainTip, localTip: git('rev-parse', 'HEAD') };
}

/** The pre-push line for `topic` at the current head, over `remoteSha`. */
function pushOf(git, remoteSha) {
  return `refs/heads/topic ${git('rev-parse', 'HEAD')} refs/heads/topic ${remoteSha}\n`;
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

describe('the comments a push checks', () => {
  it('passes a comment main added, which a merge of main brings in', () => {
    const { git, commentsStatus, pushedTip } = branchThatMergedMain(TWO_LINE_COMMENT);

    expect(commentsStatus(pushOf(git, pushedTip))).toBe(0);
  });

  it('fails a comment the merge commit itself adds', () => {
    const { dir, git, commit, commentsStatus } = repository();
    commit('base.ts');
    git('checkout', '-q', '-b', 'topic');
    const pushedTip = commit('topic.ts');
    git('checkout', '-q', 'main');
    git('update-ref', 'refs/remotes/origin/main', commit('main.ts'));
    git('checkout', '-q', 'topic');
    git('merge', '-q', '--no-commit', 'main');
    writeFileSync(join(dir, 'topic.ts'), TWO_LINE_COMMENT);
    git('add', 'topic.ts');
    git('commit', '-q', '--no-edit');

    expect(commentsStatus(pushOf(git, pushedTip))).toBe(1);
  });

  it('fails a comment a commit after the merge adds', () => {
    const { git, commit, commentsStatus, pushedTip } = branchThatMergedMain();
    commit('topic.ts', TWO_LINE_COMMENT);

    expect(commentsStatus(pushOf(git, pushedTip))).toBe(1);
  });

  it('fails a comment the first push of a branch adds (edge case)', () => {
    const { git, commit, commentsStatus } = branchThatMergedMain();
    commit('topic.ts', TWO_LINE_COMMENT);

    expect(commentsStatus(pushOf(git, NO_SHA))).toBe(1);
  });
});
