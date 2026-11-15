import { mergeBaseWithMain, parseNameStatus } from './changes.mjs';

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

/** The ref's pushed tip and where it left `origin/main`. A change counts only where every diff has it. */
function basesOf(git, localSha, remoteSha) {
  const mainBase = mergeBaseWithMain(localSha, git);
  const pushedTip = !NO_SHA.test(remoteSha) && hasCommit(git, remoteSha) ? remoteSha : undefined;
  const bases = [...new Set([pushedTip, mainBase].filter((base) => base !== undefined))];
  return bases.length > 0 ? bases : undefined;
}

/** The paths that every base's diff to `head` reports, split by whether they still exist. */
function pathsChangedInEvery(git, bases, head) {
  const perBase = bases.map((base) =>
    parseNameStatus(git('diff', '--name-status', '--no-renames', base, head))
  );
  const inEvery = (pick) =>
    pick(perBase[0]).filter((path) => perBase.every((files) => pick(files).includes(path)));
  return { changed: inEvery((files) => files.changed), deleted: inEvery((files) => files.deleted) };
}

/** The paths and each ref's `{ bases, head }` of the pre-push `stdin`. A stale `origin/main` adds main's. */
export function pushedRanges(stdin, git) {
  const changed = new Set();
  const deleted = new Set();
  const pushed = [];
  for (const line of stdin.split('\n').filter((l) => l.trim() !== '')) {
    const [, localSha, , remoteSha] = line.split(' ');
    if (NO_SHA.test(localSha)) continue;
    const bases = basesOf(git, localSha, remoteSha);
    if (bases === undefined) return undefined;
    pushed.push({ bases, head: localSha });
    const files = pathsChangedInEvery(git, bases, localSha);
    files.changed.forEach((path) => changed.add(path));
    files.deleted.forEach((path) => deleted.add(path));
  }
  return { changed: [...changed], deleted: [...deleted], pushed };
}
