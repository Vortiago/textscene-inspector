/**
 * Keeps the local Godot checkout (REFERENCES.md) a reading aid: a bound is a literal with its
 * source line cited beside it, never read from `doc/classes/<Type>.xml` at test time, since that
 * makes a multi-gigabyte clone a build requirement. Deleting the checkout leaves `pnpm validate`
 * unchanged. A cite (`scene/3d/camera_3d.cpp:682`, `doc/classes/Range.xml`) is not a violation.
 */

import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { CHECKOUT_CONTROLS, ENV_CONTROLS } from './godot-source-decoupling.controls.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..');

/**
 * A name for the checkout implies resolving it, and only REFERENCES.md, which tells a human how
 * to create it, may name it. Four spellings: a versioned tag directory, the `repos/godot` clone,
 * and a `godot` directory before an engine top-level directory, as a path or as `join()` segments.
 * A URL, such as the GitHub API fetch in `godotLinks.mjs`, can never be the checkout.
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
 * A `GODOT_*` read from the environment can only locate the checkout, except `GODOT_BIN`, a path
 * to the binary. The pattern anchors on the read (`env.X`, `env['X']`, shell `$X`), since the bare
 * name also spells this repo's constants (`GODOT_PI`). In a script file `${GODOT_X}` is a template
 * literal, so the shell form is not checked there.
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

/** Every tracked file: the guard is about the repo as shipped, not the worktree. */
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
      return false; // A tracked file can be missing mid-rebase.
    }
  });
}

/**
 * One read of the repo, shared by every assertion below, since a read per `it` costs about half a
 * second each. `linter/reactFree.test.ts` hoists its own sweep for the same reason.
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

/** The two sweeps: pattern, allowlist and post-filter together. */
const checkoutHits = (allowed, scanned) =>
  offenders(CHECKOUT_RE, allowed, scanned).filter((h) => !URL_RE.test(h.text));

const envHits = (allowed, scanned) => {
  const ext = (h) => extname(h.file).toLowerCase();
  const shell = offenders(SHELL_ENV_RE, allowed, scanned).filter((h) => !SCRIPT_EXT.has(ext(h)));
  return [...offenders(ENV_RE, allowed, scanned), ...shell].filter((h) => ext(h) !== '.md');
};

/**
 * Both sweeps with an empty allowlist, run once. `offenders` reads the allowlist only as
 * `has(file)`, so an allowlisted sweep is these hits minus the named files, without a second pass.
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
    // A pattern that matches nothing passes every emptiness check above. The clone recipe in
    // REFERENCES.md is a real offender kept on purpose, so the open sweep must report it.
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
    // A dead entry lets the next real hit on that path through, and no other assertion sees it.
    expect(deadEntries(CHECKOUT_ALLOWED, ALL_CHECKOUT_HITS)).toEqual([]);
    expect(deadEntries(ENV_ALLOWED, ALL_ENV_HITS)).toEqual([]);
  });
});
