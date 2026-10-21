/**
 * A vendored corpus that records the recipe that made it, shared by the vendor scripts. A key file
 * in each corpus holds a hash of the recipe's files, so an unchanged recipe fetches nothing, and a
 * lock file lets one process vendor at a time.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { REPO_ROOT } from './repoRoot.mjs';
import { withLock } from './vendor-lock.mjs';

const KEY_FILE = '.vendor-key';

/**
 * Vendors `corpora` unless each already holds the key of `recipe`, the repo-relative files and
 * folders that decide them. A waiting process finds the corpora current. `vendor` returns false
 * when it kept an older corpus, which then keeps its older key.
 */
export function ensureKeyedCorpora({ label, corpora, recipe, lockFile, vendor }) {
  const key = recipeKey(recipe);
  const isCurrent = () => corpora.every((corpus) => holdsKey(corpus, key));
  if (isCurrent()) {
    console.log(`[${label}] up to date`);
    return;
  }
  withLock(lockFile, () => {
    if (isCurrent() || !vendor()) return;
    for (const corpus of corpora) writeFileSync(join(corpus, KEY_FILE), key);
  });
}

/** Whether every corpus holds a key, from any recipe. */
export function holdsAnyKey(corpora) {
  return corpora.every((corpus) => existsSync(join(corpus, KEY_FILE)));
}

/** A hash of the files `recipe` names, which CI also keys its cache on. */
export function recipeKey(recipe) {
  const hash = createHash('sha256');
  for (const file of recipe.flatMap(recipeFiles).sort()) {
    // A NUL after each part keeps one path and its bytes from reading as another pair.
    hash
      .update(`${file}\0`)
      .update(readFileSync(join(REPO_ROOT, file)))
      .update('\0');
  }
  return hash.digest('hex');
}

/** The repo-relative POSIX paths of the files at `path`, a file or a folder. */
function recipeFiles(path) {
  const full = join(REPO_ROOT, path);
  if (!statSync(full).isDirectory()) return [path];
  return readdirSync(full, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(REPO_ROOT, join(e.parentPath, e.name)).split(sep).join('/'));
}

function holdsKey(corpus, key) {
  const file = join(corpus, KEY_FILE);
  return existsSync(file) && readFileSync(file, 'utf8') === key;
}
