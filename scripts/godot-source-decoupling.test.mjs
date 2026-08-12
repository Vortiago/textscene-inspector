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
function offenders(re, allowed, scanned = SCANNED) {
  const hits = [];
  for (const { file, body } of scanned) {
    if (allowed.has(file) || !re.test(body)) continue;
    body.split('\n').forEach((text, i) => {
      if (re.test(text)) hits.push({ file, line: i + 1, text: text.trim().slice(0, 120) });
    });
  }
  return hits;
}

/** The two sweeps as the assertions run them — pattern, allowlist and post-filter together. */
const checkoutHits = (allowed, scanned) =>
  offenders(CHECKOUT_RE, allowed, scanned).filter((h) => !URL_RE.test(h.text));

const envHits = (allowed, scanned) =>
  offenders(ENV_RE, allowed, scanned).filter((h) => extname(h.file).toLowerCase() !== '.md');

/**
 * Synthetic files fed to those sweeps, so the controls below prove what the
 * patterns catch without depending on what the repo happens to contain. They
 * stay in-memory and inside this file, which the allowlists already cover:
 * a scratch file on disk carrying these strings would be a real violation.
 *
 * Every row has to be able to fail. A tag row names a version OTHER than the
 * current pin, or the whole arm could be rewritten as the `4.6.3` literal and
 * still pass; `4.10` fails a `\d` that is not `\d+`; the backslash row fails a
 * separator class narrowed to `/`.
 */
const CHECKOUT_CONTROLS = [
  {
    file: 'scratch/tag-current.ts',
    hit: true,
    body: "readFileSync('/home/dev/godot-4.6.3/scene/3d/light_3d.cpp')",
  },
  {
    file: 'scratch/tag-next.ts',
    hit: true,
    body: "readFileSync('/home/dev/godot-4.7.0/scene/3d/light_3d.cpp')",
  },
  { file: 'scratch/tag-two-part.mjs', hit: true, body: "const root = '/opt/godot-4.10/doc';" },
  {
    file: 'scratch/repos-posix.ts',
    hit: true,
    body: "join(HOME, '/repos/godot/doc/classes/Range.xml')",
  },
  {
    file: 'scratch/repos-windows.ts',
    hit: true,
    body: 'join(HOME, "\\repos\\godot\\doc\\classes\\Range.xml")',
  },
  // Citing where a bound came from is the encouraged practice, not a hit.
  {
    file: 'scratch/citation.ts',
    hit: false,
    body: '// scene/3d/camera_3d.cpp:682\n// default per doc/classes/Range.xml',
  },
  {
    file: 'scratch/doc-link.mjs',
    hit: false,
    body: "const tree = 'https://api.github.com/repos/godotengine/godot/git/trees/master';",
  },
];

/** One row per `ENV_RE` alternative: two of six would leave the rest rewritable. */
const ENV_CONTROLS = [
  { file: 'scratch/env-src.ts', hit: true, body: 'const root = process.env.GODOT_SRC;' },
  { file: 'scratch/env-source.ts', hit: true, body: 'const root = process.env.GODOT_SOURCE;' },
  { file: 'scratch/env-sources.ts', hit: true, body: 'const root = process.env.GODOT_SOURCES;' },
  { file: 'scratch/env-root.ts', hit: true, body: 'const root = process.env.GODOT_ROOT;' },
  { file: 'scratch/env-checkout.mjs', hit: true, body: 'process.env.GODOT_CHECKOUT ?? ""' },
  { file: 'scratch/env-engine.mjs', hit: true, body: 'process.env.GODOT_ENGINE ?? ""' },
  // A path to the godot BINARY is a tool, and prose may name the variable.
  { file: 'scratch/env-binary.ts', hit: false, body: "process.env.GODOT_BIN ?? 'godot'" },
  { file: 'scratch/env-prose.md', hit: false, body: 'Export `GODOT_SRC` before authoring.' },
];

const expectedHits = (controls) => controls.filter((c) => c.hit).map((c) => c.file);
const hitFiles = (hits) => [...new Set(hits.map((h) => h.file))];

/**
 * Allowlist entries the sweep would not report anyway. Exact rather than
 * leave-one-out because `allowed` is consulted only as `has(file)`.
 */
const deadEntries = (allowed, hitsFor) => {
  const reported = new Set(hitFiles(hitsFor(new Set())));
  return [...allowed].filter((entry) => !reported.has(entry));
};

const format = (hits) => hits.map((h) => `${h.file}:${h.line}  ${h.text}`);

describe('Godot source stays a reading aid, not a dependency', () => {
  it('no tracked file names the local engine checkout', () => {
    expect(format(checkoutHits(CHECKOUT_ALLOWED))).toEqual([]);
  });

  it('no code file locates the engine source through the environment', () => {
    expect(format(envHits(ENV_ALLOWED))).toEqual([]);
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
    expect(hitFiles(checkoutHits(new Set()))).toContain('REFERENCES.md');
  });

  it('reports every checkout shape, whatever the tag, and no citation', () => {
    expect(hitFiles(checkoutHits(new Set(), CHECKOUT_CONTROLS))).toEqual(
      expectedHits(CHECKOUT_CONTROLS)
    );
  });

  it('reports every environment spelling, and leaves prose and the binary alone', () => {
    expect(hitFiles(envHits(new Set(), ENV_CONTROLS))).toEqual(expectedHits(ENV_CONTROLS));
  });

  it('names an allowlist entry that exempts nothing, and keeps the one that does', () => {
    const dead = deadEntries(new Set(['scratch/repos-posix.ts', 'scratch/citation.ts']), (allowed) =>
      checkoutHits(allowed, CHECKOUT_CONTROLS)
    );
    expect(dead).toEqual(['scratch/citation.ts']);
  });

  it('holds no allowlist entry that exempts nothing', () => {
    // A dead entry waves the next real hit on that path straight through, and
    // every other assertion here reads the same zero with or without it.
    expect(deadEntries(CHECKOUT_ALLOWED, checkoutHits)).toEqual([]);
    expect(deadEntries(ENV_ALLOWED, envHits)).toEqual([]);
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
