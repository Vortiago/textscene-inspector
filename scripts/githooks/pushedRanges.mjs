import { parseNameStatus } from './changes.mjs';

/** Git writes this sha for a ref that does not exist on one side of the push. */
const NO_SHA = /^0+$/;

function hasCommit(git, sha) {
  try {
    git('cat-file', '-e', `${sha}^{commit}`);
    return true;
  } catch {
    // Not in this clone: the remote moved to a commit this clone has not fetched.
    return false;
  }
}

function mergeBaseWithMain(git, rev) {
  try {
    return git('merge-base', rev, 'origin/main');
  } catch {
    // No `origin/main` in this clone.
    return undefined;
  }
}

/** The commit a pushed ref is compared against, or undefined when none is known. */
function baseOf(git, localSha, remoteSha) {
  if (!NO_SHA.test(remoteSha) && hasCommit(git, remoteSha)) return remoteSha;
  return mergeBaseWithMain(git, localSha);
}

/** The changed and deleted paths of the pre-push `stdin`, and each ref's `{ bases, head }`, or undefined. */
export function pushedRanges(stdin, git) {
  const changed = new Set();
  const deleted = new Set();
  const pushed = [];
  for (const line of stdin.split('\n').filter((l) => l.trim() !== '')) {
    const [, localSha, , remoteSha] = line.split(' ');
    if (NO_SHA.test(localSha)) continue;
    const base = baseOf(git, localSha, remoteSha);
    if (base === undefined) return undefined;
    // A line counts only where both diffs add it, so no line of main or of a stacked base counts.
    pushed.push({ bases: [...new Set([base, mergeBaseWithMain(git, localSha) ?? base])], head: localSha });
    const files = parseNameStatus(git('diff', '--name-status', '--no-renames', base, localSha));
    files.changed.forEach((path) => changed.add(path));
    files.deleted.forEach((path) => deleted.add(path));
  }
  return { changed: [...changed], deleted: [...deleted], pushed };
}
