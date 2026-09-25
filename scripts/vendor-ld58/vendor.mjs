/**
 * The vendoring flow: acquire the source (local checkout or shallow fetch),
 * wipe and refill `scenes/ld58/` from the manifest, script-strip every .tscn.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { REPO_ROOT } from '../repoRoot.mjs';
import { fetchShallow } from '../vendor-git.mjs';
import { FILES } from './files.mjs';
import { stripScripts } from './stripScripts.mjs';

export const TARGET = join(REPO_ROOT, 'scenes/ld58');
const DEFAULT_URL = 'https://github.com/Vortiago/ld-58.git';

/** The value of `--flag` in argv, or undefined. */
function argValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

export function vendorLd58() {
  const argv = process.argv.slice(2);
  const srcArg = argValue(argv, '--src');
  const url = argValue(argv, '--url') ?? DEFAULT_URL;
  const ref = argValue(argv, '--ref') ?? 'main';

  let srcRoot;
  let work;
  try {
    if (srcArg) {
      srcRoot = resolve(srcArg);
      if (!existsSync(srcRoot)) {
        console.error(`[vendor-ld58] --src path not found: ${srcRoot}`);
        process.exitCode = 1;
        return;
      }
      console.log(`[vendor-ld58] copying from local checkout ${srcRoot}`);
    } else {
      work = mkdtempSync(join(tmpdir(), 'vendor-ld58-'));
      srcRoot = work;
      process.stdout.write(`[vendor-ld58] fetching ${url} @ ${ref} … `);
      fetchShallow(url, ref, srcRoot);
      console.log('done');
    }
  } catch {
    // Only acquisition gets the message without a stack: a fetch failure is a network or remote
    // problem, not a bug here.
    console.error(
      `\n[vendor-ld58] Could not obtain the ld-58 source` +
        (srcArg ? ` from ${srcArg}.` : ` from ${url} (ref ${ref}).`) +
        `\n  The repo is public — check network access / the URL, or vendor from` +
        `\n  a local checkout instead:` +
        `\n    pnpm vendor:ld58 --src /path/to/ld-58`
    );
    process.exitCode = 1;
    if (work) rmSync(work, { recursive: true, force: true });
    return;
  }

  // The source is here, so a failure is a real bug and surfaces with its own error.
  try {
    rmSync(TARGET, { recursive: true, force: true });
    mkdirSync(TARGET, { recursive: true });

    const missing = [];
    let copied = 0;
    let stripped = 0;
    for (const rel of FILES) {
      const from = join(srcRoot, rel);
      const to = join(TARGET, rel);
      if (!existsSync(from)) {
        missing.push(rel);
        continue;
      }
      mkdirSync(dirname(to), { recursive: true });
      if (rel.endsWith('.tscn')) {
        writeFileSync(to, stripScripts(readFileSync(from, 'utf8')));
        stripped++;
      } else {
        copyFileSync(from, to);
      }
      copied++;
    }

    console.log(`[vendor-ld58] vendored ${copied}/${FILES.length} files (${stripped} .tscn script-stripped) into scenes/ld58/`);
    if (missing.length) {
      console.warn(
        `[vendor-ld58] ${missing.length} manifest path(s) not found at the source ` +
          `(the repo may have drifted — update the FILES manifest):\n  - ${missing.join('\n  - ')}`
      );
    }
  } catch (err) {
    console.error('[vendor-ld58] vendoring failed after the source was obtained (scenes/ld58/ may be partial):', err);
    process.exitCode = 1;
  } finally {
    if (work) rmSync(work, { recursive: true, force: true });
  }
}
