/**
 * Guards the boundary between the Godot engine source and this repository.
 *
 * Linter validators are measured from the engine source rather than guessed — a
 * `PROPERTY_HINT_RANGE` bound exists nowhere else — so a local checkout of
 * godot at the matching tag is a normal part of authoring a node slice
 * (REFERENCES.md says how to get one). The knowledge is what matters; the files
 * are not. A bound is baked in as a literal and the governing source line is
 * reproduced as a comment beside it.
 *
 * The failure this prevents: someone finds it convenient to read
 * `doc/classes/<Type>.xml` at test time to enumerate properties, or points a
 * generator at the checkout. That silently makes a multi-gigabyte external
 * clone a build requirement — every contributor and CI runner without it breaks,
 * and the repo becomes pinned to one engine version by accident rather than by
 * decision. Deleting the checkout must leave `pnpm validate` unchanged.
 *
 * Citing a source location in a comment — `scene/3d/camera_3d.cpp:682`, or the
 * established `doc/classes/Range.xml` shorthand for where a default came from —
 * is the encouraged practice, not a violation. The checkout lives outside the
 * repo, so anything actually reaching it has to name it or read it out of the
 * environment; those are the two patterns below.
 */

import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');

/**
 * Naming the checkout at all implies resolving it. Prose in REFERENCES.md is the
 * one place that must, since it tells a human how to create it.
 *
 * URLs are excluded rather than allowlisted: `godotLinks.mjs` builds
 * `api.github.com/repos/godotengine/godot/...` to resolve documentation links,
 * which is a network fetch of a public API and the opposite of a local-path
 * dependency. A URL can never be the checkout.
 */
const CHECKOUT_RE = /godot-4\.\d+(\.\d+)?(-stable)?\b|[\\/]repos[\\/]godot/;
const URL_RE = /https?:\/\//;
const CHECKOUT_ALLOWED = new Set(['REFERENCES.md', 'scripts/godot-source-decoupling.test.mjs']);

/**
 * The other way in is the environment. A citation cannot come from `process.env`,
 * so any such variable exists to locate the checkout at run time.
 */
const ENV_RE = /\bGODOT_(SRC|SOURCE|SOURCES|ROOT|CHECKOUT|ENGINE)\b/;
const ENV_ALLOWED = new Set(['scripts/godot-source-decoupling.test.mjs']);

/** Binary and generated payloads: scanning them is slow and meaningless. */
const SKIP_EXT = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.svg',
  '.glb',
  '.gltf',
  '.bin',
  '.ttf',
  '.woff',
  '.woff2',
  '.mp3',
  '.ogg',
  '.wav',
  '.zip',
  '.vsix',
  '.pdf',
]);

const MAX_BYTES = 2 * 1024 * 1024;

/** Every tracked file — the guard is about the repo as shipped, not the worktree. */
function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

function scannableFiles() {
  return trackedFiles().filter((rel) => {
    if (SKIP_EXT.has(extname(rel).toLowerCase())) return false;
    try {
      return statSync(join(REPO_ROOT, rel)).size <= MAX_BYTES;
    } catch {
      return false; // deleted-but-tracked mid-rebase
    }
  });
}

/**
 * One read of the repo, shared by every assertion below. Walking and reading
 * ~3,800 tracked files per `it` costs about half a second of pure duplicate
 * work; `linter/reactFree.test.ts` hoists its own sweep for the same reason.
 */
const SCANNED = scannableFiles().map((file) => ({
  file,
  body: readFileSync(join(REPO_ROOT, file), 'utf8'),
}));

/** `[{ file, line, text }]` for every line matching `re`, outside `allowed`. */
function offenders(re, allowed) {
  const hits = [];
  for (const { file, body } of SCANNED) {
    if (allowed.has(file) || !re.test(body)) continue;
    body.split('\n').forEach((text, i) => {
      if (re.test(text)) hits.push({ file, line: i + 1, text: text.trim().slice(0, 120) });
    });
  }
  return hits;
}

const format = (hits) => hits.map((h) => `${h.file}:${h.line}  ${h.text}`);

describe('Godot source stays a reading aid, not a dependency', () => {
  it('no tracked file names the local engine checkout', () => {
    const local = offenders(CHECKOUT_RE, CHECKOUT_ALLOWED).filter((h) => !URL_RE.test(h.text));
    expect(format(local)).toEqual([]);
  });

  it('no code file locates the engine source through the environment', () => {
    const codeOnly = offenders(ENV_RE, ENV_ALLOWED).filter(
      (h) => extname(h.file).toLowerCase() !== '.md'
    );
    expect(format(codeOnly)).toEqual([]);
  });

  it('scans a meaningful share of the repo, so a broken glob cannot pass it', () => {
    expect(SCANNED.length).toBeGreaterThan(200);
  });

  it('flags the allowlisted REFERENCES.md mention once the allowlist is dropped', () => {
    // Every assertion above is an emptiness check, so a pattern that matches
    // nothing passes all of them and the guard is disarmed in silence. The
    // clone recipe in REFERENCES.md is a real offender kept on purpose, so run
    // the whole sweep with an empty allowlist and require it back.
    expect(CHECKOUT_ALLOWED.has('REFERENCES.md')).toBe(true);
    const unallowed = offenders(CHECKOUT_RE, new Set()).filter((h) => !URL_RE.test(h.text));
    expect(unallowed.map((h) => h.file)).toContain('REFERENCES.md');
  });

  it('matches the path shapes it exists to catch, and leaves a citation alone', () => {
    expect(CHECKOUT_RE.test("readFileSync('/home/dev/godot-4.6.3/scene/3d/light_3d.cpp')")).toBe(
      true
    );
    expect(CHECKOUT_RE.test("join(HOME, '/repos/godot/doc/classes/Range.xml')")).toBe(true);
    // Citing where a bound came from is the encouraged practice, not a hit.
    expect(CHECKOUT_RE.test('// scene/3d/camera_3d.cpp:682')).toBe(false);
    expect(CHECKOUT_RE.test('// default per doc/classes/Range.xml')).toBe(false);
  });

  it('matches an environment lookup, and leaves an unrelated GODOT_ var alone', () => {
    expect(ENV_RE.test('const root = process.env.GODOT_SRC;')).toBe(true);
    expect(ENV_RE.test('process.env.GODOT_CHECKOUT ?? ""')).toBe(true);
    // A path to the godot BINARY is a tool, not the source tree.
    expect(ENV_RE.test("process.env.GODOT_BIN ?? 'godot'")).toBe(false);
  });
});
