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
import { CHECKOUT_CONTROLS, ENV_CONTROLS } from './godot-source-decoupling.controls.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..');

/**
 * Naming the checkout at all implies resolving it. Prose in REFERENCES.md is the
 * one place that must, since it tells a human how to create it.
 *
 * Four spellings: a versioned tag directory, the `repos/godot` clone location,
 * and a `godot` directory followed by one of the engine's top-level
 * directories — as a slash path or as `join()` segments.
 *
 * URLs are excluded rather than allowlisted: `godotLinks.mjs` builds
 * `https://api.github.com/repos/godotengine/godot/...` to resolve documentation links,
 * which is a network fetch of a public API and the opposite of a local-path
 * dependency. A URL can never be the checkout.
 */
const ENGINE_DIRS = 'scene|core|doc|modules|servers|main|platform|editor';
const CHECKOUT_RE = new RegExp(
  [
    'godot-4\\.\\d+(\\.\\d+)?(-stable)?\\b',
    '[\\\\/]repos[\\\\/]godot',
    `\\bgodot[\\\\/](?:${ENGINE_DIRS})\\b`,
    `['"]godot['"]\\s*,\\s*['"](?:${ENGINE_DIRS})['"]`,
  ].join('|')
);
const URL_RE = /https?:\/\//;
const CHECKOUT_ALLOWED = new Set(['REFERENCES.md', 'scripts/godot-source-decoupling.controls.mjs']);

/**
 * The other way in is the environment. A citation cannot come from `process.env`,
 * so any `GODOT_*` variable READ exists to locate the checkout at run time,
 * whatever its suffix. `GODOT_BIN` alone is exempt: a path to the godot binary
 * is a tool. Anchored on the read — `env.X`, `env['X']`, shell `$X` — because
 * the bare name also spells this repo's own constants (`GODOT_PI`).
 *
 * The shell form is not read in script files: there `${GODOT_X}` is a template
 * literal interpolating one of those constants.
 */
const ENV_RE = /\benv(?:\.|\[['"])GODOT_(?!BIN\b)[A-Z_]+\b/;
const SHELL_ENV_RE = /\$\{?GODOT_(?!BIN\b)[A-Z_]+\b/;
const SCRIPT_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const ENV_ALLOWED = new Set(['scripts/godot-source-decoupling.controls.mjs']);

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
 * the ~5,600 tracked files per `it` costs about half a second of pure duplicate
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

/** The two sweeps — pattern, allowlist and post-filter together. */
const checkoutHits = (allowed, scanned) =>
  offenders(CHECKOUT_RE, allowed, scanned).filter((h) => !URL_RE.test(h.text));

const envHits = (allowed, scanned) => {
  const ext = (h) => extname(h.file).toLowerCase();
  const shell = offenders(SHELL_ENV_RE, allowed, scanned).filter((h) => !SCRIPT_EXT.has(ext(h)));
  return [...offenders(ENV_RE, allowed, scanned), ...shell].filter((h) => ext(h) !== '.md');
};

/**
 * Both sweeps with the allowlist open, read once for every assertion below.
 * `offenders` consults the allowlist only as `has(file)`, so an allowlisted
 * sweep is exactly these hits minus the files the allowlist names, and a second
 * pass over the repo to learn that costs another 40ms per assertion.
 */
const ALL_CHECKOUT_HITS = checkoutHits(new Set());
const ALL_ENV_HITS = envHits(new Set());

const expectedHits = (controls) => controls.filter((c) => c.hit).map((c) => c.file);
const hitFiles = (hits) => [...new Set(hits.map((h) => h.file))];

/** Allowlist entries the open sweep would not report anyway. */
const deadEntries = (allowed, openHits) => {
  const reported = new Set(hitFiles(openHits));
  return [...allowed].filter((entry) => !reported.has(entry));
};

const format = (hits) => hits.map((h) => `${h.file}:${h.line}  ${h.text}`);

describe('Godot source stays a reading aid, not a dependency', () => {
  it('no tracked file names the local engine checkout', () => {
    expect(format(ALL_CHECKOUT_HITS.filter((h) => !CHECKOUT_ALLOWED.has(h.file)))).toEqual([]);
  });

  it('no code file locates the engine source through the environment', () => {
    expect(format(ALL_ENV_HITS.filter((h) => !ENV_ALLOWED.has(h.file)))).toEqual([]);
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
    expect(hitFiles(ALL_CHECKOUT_HITS)).toContain('REFERENCES.md');
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
    const dead = deadEntries(
      new Set(['scratch/repos-posix.ts', 'scratch/citation.ts']),
      checkoutHits(new Set(), CHECKOUT_CONTROLS)
    );
    expect(dead).toEqual(['scratch/citation.ts']);
  });

  it('holds no allowlist entry that exempts nothing', () => {
    // A dead entry waves the next real hit on that path straight through, and
    // every other assertion here reads the same zero with or without it.
    expect(deadEntries(CHECKOUT_ALLOWED, ALL_CHECKOUT_HITS)).toEqual([]);
    expect(deadEntries(ENV_ALLOWED, ALL_ENV_HITS)).toEqual([]);
  });
});
