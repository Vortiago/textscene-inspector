/**
 * Structural guard over the comparison sheets.
 *
 * Nothing checked these before: `build-gallery.mjs` throws on a few fatal shapes
 * during the web build, and silently coerces an unknown `status=` to
 * `unreviewed`, so a typo'd frontmatter key or a dangling image was invisible.
 *
 * Three rules here are load-bearing rather than tidy. `build-gallery` only reports
 * a missing image when `image:` is DECLARED (so a freshly scaffolded slice cannot
 * break the web build), which leaves two holes this file closes: an unknown key
 * catches `imgae:`, and the status rule catches `image:` being deleted from a
 * sheet that claims a verified status. The third closes a hole those two open
 * between them: a SECTIONED sheet (one carrying `<!-- compare: … -->` markers)
 * takes its nav badge from the rollup over its section statuses, never from
 * frontmatter, so a frontmatter `status:` there is never read by anything — and
 * every other check above skips sectioned sheets when judging `status:`, so
 * nothing was watching that dead value for a contradiction.
 */

import { describe, expect, it } from 'vitest';
import { readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LINT_EXEMPT_CATEGORIES as LINT_EXEMPT,
  collectSheetFiles,
  findCommentedFrontmatterKeys,
  findImage,
  findScene,
  parseCompareMarkers,
  parseFrontmatter,
  sheetLabel,
} from './sheetSources.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const KNOWN_KEYS = new Set([
  'type',
  'category',
  'status',
  'fixture',
  'image',
  'renders_as',
  'visual',
  'group',
  'camera',
]);
const STATUSES = new Set(['done', 'limitation', 'unimplemented', 'unreviewed']);
const CATEGORIES = new Set(['3D', '2D', 'Resources', 'Complex Scenes', 'Other']);

const sheets = await Promise.all(
  collectSheetFiles().map(async (file) => {
    const text = await readFile(file, 'utf8');
    const parsed = parseFrontmatter(text);
    return {
      label: sheetLabel(file),
      meta: parsed?.meta ?? {},
      body: parsed?.body ?? '',
      hasFrontmatter: Boolean(parsed),
      text,
    };
  })
);

const hasImage = (basename, side) => Boolean(findImage(basename, side));

describe('comparison sheets', () => {
  it('finds the corpus', () => {
    expect(sheets.length).toBeGreaterThan(50);
  });

  it('every sheet has frontmatter with type and category', () => {
    const bad = sheets
      .filter((s) => !s.hasFrontmatter || !s.meta.type || !s.meta.category)
      .map((s) => s.label);
    expect(bad).toEqual([]);
  });

  it('uses no unknown frontmatter key', () => {
    // A typo'd key is otherwise silent: `imgae:` reads as a sheet with no image,
    // which the gallery now treats as "not captured yet" rather than an error.
    const unknown = sheets.flatMap((s) =>
      Object.keys(s.meta)
        .filter((k) => !KNOWN_KEYS.has(k))
        .map((k) => `${s.label}: ${k}`)
    );
    expect(unknown.sort()).toEqual([]);
  });

  it('hides no known frontmatter key behind a comment', () => {
    // `# image: unit-foo` reads, to a human skimming the file, as an already-set
    // value — but `parseFrontmatter`'s key regex cannot match past the `#`, so
    // the key is silently absent from `meta` for every consumer (recapture has
    // no target, build-gallery has no basename). A freshly scaffolded slice
    // ships with the key OMITTED entirely, never commented out; this is the
    // loud backstop for that convention slipping (a hand-edit, a stale scaffold,
    // a copy-paste from an older sheet).
    const bad = sheets.flatMap((s) =>
      findCommentedFrontmatterKeys(s.text)
        .filter((k) => KNOWN_KEYS.has(k))
        .map((k) => `${s.label}: # ${k}`)
    );
    expect(bad.sort()).toEqual([]);
  });

  it('uses only known status and category values', () => {
    const bad = sheets.flatMap((s) => {
      const problems = [];
      if (s.meta.status && !STATUSES.has(s.meta.status)) {
        // build-gallery silently coerces this to `unreviewed`.
        problems.push(`${s.label}: status=${s.meta.status}`);
      }
      if (!CATEGORIES.has(s.meta.category)) problems.push(`${s.label}: category=${s.meta.category}`);
      return problems;
    });
    expect(bad.sort()).toEqual([]);
  });

  it('declares an image once it claims a verified status', () => {
    // `done`/`limitation` assert a comparison someone actually looked at, which
    // is impossible without captures. Scaffolded sheets are `unreviewed` and pass.
    // Excludes sectioned sheets: their own `image:` (if any) is the header pair,
    // not the thing a top-level `status:` would be claiming about — the next
    // test below is the one that polices their frontmatter status.
    const bad = sheets
      .filter((s) => s.meta.visual !== 'false' && !s.body.includes('<!-- compare:'))
      .filter((s) => ['done', 'limitation'].includes(s.meta.status) && !s.meta.image)
      .map((s) => s.label);
    expect(bad).toEqual([]);
  });

  it('declares no frontmatter status on a sectioned sheet', () => {
    // build-gallery.mjs never reads frontmatter `status:` for a sectioned sheet
    // (one carrying a `<!-- compare: … -->` marker) — its nav badge and header
    // rolls up from its sections' own `status=` attributes instead. A frontmatter
    // `status:` there is a second, unread source of truth that can silently say
    // something the sections do not: PointLight2D declared `limitation` while
    // every one of its seven sections was `done`, and the badge always read
    // "Done". Forbidding the key outright is the fix that cannot rot again.
    const bad = sheets
      .filter((s) => s.body.includes('<!-- compare:'))
      .filter((s) => s.meta.status)
      .map((s) => `${s.label}: status=${s.meta.status}`);
    expect(bad.sort()).toEqual([]);
  });

  it('references only images that exist', () => {
    const missing = [];
    for (const s of sheets) {
      const basenames = parseCompareMarkers(s.body).map((a) => a.image).filter(Boolean);
      if (s.meta.image) basenames.push(s.meta.image);
      for (const basename of basenames) {
        for (const side of ['godot', 'ours']) {
          if (!hasImage(basename, side)) missing.push(`${s.label}: ${basename}-${side}`);
        }
      }
    }
    expect(missing.sort()).toEqual([]);
  });

  it('renders the header pair of a sheet that ALSO has sections', async () => {
    // A sheet's own `image:` and its section markers are both sources, never
    // either/or. The gallery used to resolve the header pair only when a sheet
    // had no sections, so the first section silently swallowed the sheet's own
    // comparison — on the whole-scene sheets that overview IS the subject. The
    // loss was invisible: every other image on the page still rendered, and the
    // build stayed green because nothing was missing, only unreferenced.
    const sectionedWithHeader = sheets.filter(
      (s) => s.meta.image && parseCompareMarkers(s.body).length > 0
    );
    expect(sectionedWithHeader.length).toBeGreaterThan(0);

    // Generated in a SUBPROCESS: build-gallery.mjs parses argv at module scope,
    // so importing it would run a full build as an import side effect.
    const out = join(tmpdir(), `gallery-header-pair-${process.pid}.html`);
    execFileSync(process.execPath, [join(HERE, 'build-gallery.mjs'), '--out', out], {
      stdio: 'ignore',
    });
    const html = await readFile(out, 'utf8');
    await rm(out, { force: true });
    const dropped = sectionedWithHeader
      .filter((s) => !html.includes(`${s.meta.image}-ours.png`))
      .map((s) => `${s.label}: ${s.meta.image}`);
    expect(dropped.sort()).toEqual([]);
  });

  it('has a matched, single lint block exactly where one belongs', () => {
    const problems = [];
    for (const s of sheets) {
      const begins = [...s.body.matchAll(/<!-- lint:begin ([^\s]+) -->/g)];
      const ends = (s.body.match(/<!-- lint:end -->/g) ?? []).length;
      if (LINT_EXEMPT.has(s.meta.category)) {
        if (begins.length || ends) problems.push(`${s.label}: exempt but has a lint marker`);
        continue;
      }
      if (begins.length !== 1 || ends !== 1) {
        problems.push(`${s.label}: ${begins.length} begin / ${ends} end markers`);
        continue;
      }
      if (begins[0][1] !== s.meta.type) {
        problems.push(`${s.label}: lint block names ${begins[0][1]}, frontmatter says ${s.meta.type}`);
      }
    }
    expect(problems.sort()).toEqual([]);
  });

  it('carries hand-written lenient-parser prose under every lint block', () => {
    const bare = sheets
      .filter((s) => !LINT_EXEMPT.has(s.meta.category))
      .filter((s) => {
        const end = s.body.indexOf('<!-- lint:end -->');
        if (end === -1) return false;
        const after = s.body.slice(end + '<!-- lint:end -->'.length).split(/^## /m)[0];
        return after.trim().length < 40;
      })
      .map((s) => s.label);
    expect(bare).toEqual([]);
  });

  it('claims one type per sheet', () => {
    // Two sheets sharing a type render two panels and the nav unhides both.
    const byType = new Map();
    for (const s of sheets) {
      if (!byType.has(s.meta.type)) byType.set(s.meta.type, []);
      byType.get(s.meta.type).push(s.label);
    }
    const collisions = [...byType]
      .filter(([, files]) => files.length > 1)
      .map(([type, files]) => `${type}: ${files.join(', ')}`);
    expect(collisions).toEqual([]);
  });

  it('links to no other Markdown file', () => {
    // A relative .md link cannot work: sheets sit at varying depths in the slice
    // tree, and the gallery emits the href verbatim into one flat HTML page, so
    // it is dead there and on the deployed site. Name the other sheet instead.
    const bad = sheets
      .flatMap((s) =>
        [...s.body.matchAll(/\]\(([^)]+\.md[^)]*)\)/g)].map((m) => `${s.label} -> ${m[1]}`)
      )
      .sort();
    expect(bad).toEqual([]);
  });

  it('deep-links only fixtures that exist', () => {
    // `fixture:` becomes a `?fixture=` link into the live previewer; a renamed
    // scene leaves the sheet pointing at nothing.
    const fixtures = sheets.flatMap((s) => {
      const declared = parseCompareMarkers(s.body).map((a) => a.fixture).filter(Boolean);
      if (s.meta.fixture) declared.push(s.meta.fixture);
      return declared.map((f) => ({ label: s.label, fixture: f }));
    });
    const missing = fixtures
      .filter(({ fixture }) => !findScene(fixture))
      .map(({ label, fixture }) => `${label} -> ${fixture}`);
    expect(missing.sort()).toEqual([]);
  });

  it('maps each image basename to a single fixture', () => {
    // Two sheets SHARING one capture is deliberate and common (CollisionShape3D
    // and RigidBody3D document the same image). What must not happen is one
    // basename claimed for two different scenes: recapture's byImage map is
    // last-wins, so that silently decides which scene lands in the file.
    const byImage = new Map();
    for (const s of sheets) {
      const pairs = parseCompareMarkers(s.body);
      if (s.meta.image) pairs.push({ image: s.meta.image, fixture: s.meta.fixture });
      for (const { image, fixture } of pairs) {
        if (!image || !fixture) continue;
        if (!byImage.has(image)) byImage.set(image, new Set());
        byImage.get(image).add(fixture);
      }
    }
    const conflicting = [...byImage]
      .filter(([, fixtures]) => fixtures.size > 1)
      .map(([image, fixtures]) => `${image}: ${[...fixtures].join(' vs ')}`);
    expect(conflicting.sort()).toEqual([]);
  });

  it('hand-writes no ADR link or path, leaving them to the generator', () => {
    // Relative depth varies per slice, and the deployed site has no docs/ tree.
    const bad = sheets
      .filter((s) => /\]\([^)]*adr\/|\[ADR-\d{4}\]:/.test(s.body))
      .map((s) => s.label);
    expect(bad).toEqual([]);
  });
});
