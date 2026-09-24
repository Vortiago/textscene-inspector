/**
 * Structural guard over the comparison sheets. The gallery coerces an unknown
 * `status=` to `unreviewed` and reports a missing image only when `image:` is
 * declared, so a typo'd key or a deleted `image:` is caught here.
 */

import { describe, expect, it } from 'vitest';
import { readFile, rm } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isDivider, splitRow } from './markdownTable.mjs';
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
const NODES_ROOT = join(HERE, '../../packages/textscene-core/src/nodes');

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
const STATUSES = new Set(['done', 'limitation', 'unimplemented', 'unreviewed', 'linter-only']);
const CATEGORIES = new Set(['3D', '2D', 'Resources', 'Complex Scenes', 'Other']);

/**
 * The hand-maintained index at docs/comparison/README.md, and the node count in
 * the root README. Hand-written on purpose, since the blurbs are richer than
 * `renders_as:`. Only the set of entries is asserted, never their prose.
 */
const COMPARISON_INDEX = join(HERE, '../../docs/comparison/README.md');
const ROOT_README = join(HERE, '../../README.md');

const sheets = await Promise.all(
  collectSheetFiles().map(async (file) => {
    const text = await readFile(file, 'utf8');
    const parsed = parseFrontmatter(text);
    return {
      file,
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
    // which the gallery treats as "not captured yet".
    const unknown = sheets.flatMap((s) =>
      Object.keys(s.meta)
        .filter((k) => !KNOWN_KEYS.has(k))
        .map((k) => `${s.label}: ${k}`)
    );
    expect(unknown.sort()).toEqual([]);
  });

  it('hides no known frontmatter key behind a comment, `image` aside', () => {
    // `parseFrontmatter` cannot see a commented key. `image` is the exception:
    // an un-captured sheet commits `# image: <basename>` to reserve the name its
    // capture will write, and the absent key tells the gallery it has no pair.
    const bad = sheets.flatMap((s) =>
      findCommentedFrontmatterKeys(s.text)
        .filter((k) => KNOWN_KEYS.has(k) && k !== 'image')
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
    // `done`/`limitation` claim a comparison someone looked at, which needs
    // captures. Sectioned sheets are the next test's subject.
    const bad = sheets
      .filter((s) => s.meta.visual !== 'false' && !s.body.includes('<!-- compare:'))
      .filter((s) => ['done', 'limitation'].includes(s.meta.status) && !s.meta.image)
      .map((s) => s.label);
    expect(bad).toEqual([]);
  });

  it('declares no frontmatter status on a sectioned sheet', () => {
    // The gallery never reads frontmatter `status:` for a sectioned sheet: its
    // badge rolls up from the sections' `status=`. A frontmatter one would be a
    // second, unread source of truth, so the key is forbidden.
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
    // A sheet's own `image:` and its section markers are both sources, or the
    // first section silently swallows the sheet's own comparison.
    const sectionedWithHeader = sheets.filter(
      (s) => s.meta.image && parseCompareMarkers(s.body).length > 0
    );
    expect(sectionedWithHeader.length).toBeGreaterThan(0);

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

  it('gives every table row the cell count its own header declares', () => {
    // `docs:lint-sections --check` diffs the generator against its own output,
    // so a row it malformed reads as up to date. An unescaped `|` in a bit-mask
    // `Accepts` string splits into more `<td>` than `<th>`.
    const problems = [];
    let tables = 0;
    for (const s of sheets) {
      const lines = s.body.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].trim().startsWith('|')) continue;
        const rows = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++]);
        tables++;
        const width = splitRow(rows[0]).length;
        for (const row of rows) {
          if (isDivider(row.trim())) continue;
          const got = splitRow(row).length;
          if (got !== width) problems.push(`${s.label}: ${got} cells in a ${width}-column table — ${row.trim()}`);
        }
      }
    }
    // A derived floor, not a fixed count: a sheet holding a table row must
    // yield a table to the sweep, so a shrinking corpus moves both sides and a
    // sweep that stops matching moves one.
    const sheetsHoldingARow = sheets.filter((s) =>
      s.body.split('\n').some((line) => line.trim().startsWith('|'))
    ).length;
    expect(tables).toBeGreaterThanOrEqual(sheetsHoldingARow);
    expect(sheetsHoldingARow).toBeGreaterThan(sheets.length * 0.9);
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
    // A relative .md link is dead: sheets sit at varying depths, and the gallery
    // emits the href verbatim into one flat page. Name the other sheet instead.
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
    // Two sheets may share one capture, but not one basename for two scenes:
    // recapture's byImage map is last-wins.
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

  /**
   * A sheet's status against the r3f registration, which is what the viewport
   * does. `visual:` is not tied to it: a gizmo node (ADR-0018) draws but has no
   * useful pair, and a RigidBody3D draws nothing but its capture shows its mesh.
   */
  /**
   * The type names an `index.r3f.ts` registers: inline `typeName: 'Foo'`
   * literals, and a family's loop over a constant its React-free sibling
   * `index.ts` exports.
   */
  function typesRegisteredBy(r3fFile) {
    const source = readFileSync(r3fFile, 'utf8');
    const inline = [...source.matchAll(/typeName:\s*'([A-Za-z0-9_]+)'/g)].map((m) => m[1]);
    if (inline.length > 0) return inline;
    const looped = /import \{\s*([A-Z0-9_]+)\s*\} from '\.\/index'/.exec(source);
    if (!looped) return [];
    const sibling = readFileSync(join(dirname(r3fFile), 'index.ts'), 'utf8');
    const literal = new RegExp(`${looped[1]}\\s*=\\s*\\[([^\\]]*)\\]`).exec(sibling);
    return literal ? [...literal[1].matchAll(/'([A-Za-z0-9_]+)'/g)].map((m) => m[1]) : [];
  }

  /**
   * The registration that speaks for `type`, or null: its file and its intent.
   * It walks to an ancestor for the family loops (`physics/2d/index.r3f.ts`),
   * and the ancestor must name the type, or a drawing slice below it passes.
   */
  function registrationFor(sliceDir, type) {
    for (let dir = sliceDir; dir.includes(`${sep}nodes`); dir = dirname(dir)) {
      const candidate = join(dir, 'index.r3f.ts');
      if (!existsSync(candidate)) continue;
      if (!typesRegisteredBy(candidate).includes(type)) continue;
      const source = readFileSync(candidate, 'utf8');
      const intent = /renderIntent:\s*'([a-z-]+)'/.exec(source);
      return { file: candidate, intent: intent ? intent[1] : 'draws' };
    }
    return null;
  }

  describe('status agrees with the render registration', () => {
    /** Slice-backed sheets only; the `complex-*` showcases have no slice. */
    // Read once per slice, not once per directional assertion.
    const sliceSheets = sheets
      .filter((s) => s.file.includes(`${sep}nodes${sep}`))
      .map((s) => {
        const registration = registrationFor(dirname(s.file), s.meta.type);
        return {
          ...s,
          hasComponent: registration !== null,
          transformOnly: registration?.intent === 'transform-only',
          // A `pending` registration mounts a base component while the node's
          // own visual is missing: a registered gap.
          pending: registration?.intent === 'pending',
        };
      });

    it('finds slice-backed sheets, so a bad filter cannot vacuously pass', () => {
      expect(sliceSheets.length).toBeGreaterThan(50);
    });

    it('credits a family loop only to the types it registers', () => {
      // A loop registration: three slices own no `index.r3f.ts` and must
      // resolve, while another slice in the same directory must not inherit it.
      const family = join(NODES_ROOT, 'physics/2d/index.r3f.ts');
      expect(typesRegisteredBy(family).sort()).toEqual([
        'CharacterBody2D',
        'RigidBody2D',
        'StaticBody2D',
      ]);
      expect(registrationFor(join(NODES_ROOT, 'physics/2d/rigidbody2d'), 'RigidBody2D')?.file).toBe(
        family
      );
      expect(registrationFor(join(NODES_ROOT, 'physics/2d/rigidbody2d'), 'ProgressBar')).toBeNull();
    });

    it('gives every slice-backed sheet a status, so none sits outside the checks', () => {
      // Every assertion in this block filters on a status literal, so a sheet
      // without one would escape them all. Resource sheets are in this check
      // only: a Resource slice registers through `registerResourceSlice`
      // (ADR-0031), not `nodeComponentRegistry`.
      const slice = (s) =>
        s.file.includes(`${sep}nodes${sep}`) || s.file.includes(`${sep}resources${sep}`);
      // A sectioned sheet is exempt: the guard above forbids its key.
      const backed = sheets.filter(slice).filter((s) => !s.body.includes('<!-- compare:'));
      expect(backed.length).toBeGreaterThan(230);
      expect(backed.filter((s) => !s.meta.status).map((s) => s.label)).toEqual([]);
    });

    it('backs every `linter-only` sheet with a transform-only registration', () => {
      const bad = sliceSheets
        .filter((s) => s.meta.status === 'linter-only' && !s.transformOnly)
        .map((s) => `${s.label}: claims linter-only but its index.r3f.ts is not transform-only`);
      expect(bad).toEqual([]);
    });

    it('never calls a transform-only registration `unimplemented`', () => {
      // Narrow on purpose: `transform-only` is about the node's own geometry,
      // and a driver such as AnimationPlayer has none but a visible effect. Only
      // the contradiction is forbidden: registered as invisible and a gap.
      const bad = sliceSheets
        .filter((s) => s.transformOnly && s.meta.status === 'unimplemented')
        .map((s) => `${s.label}: registers transform-only but claims to be unimplemented`);
      expect(bad).toEqual([]);
    });

    it('leaves every `unimplemented` sheet without a component that claims to draw', () => {
      // A gap may register its base to keep `visible` and the workspace split,
      // with `renderIntent: 'pending'`, but not claim a finished visual.
      const bad = sliceSheets
        .filter((s) => s.meta.status === 'unimplemented' && s.hasComponent && !s.pending)
        .map((s) => `${s.label}: claims unimplemented but registers a drawing component`);
      expect(bad).toEqual([]);
    });

    it('never lets a `pending` registration claim a finished status', () => {
      const bad = sliceSheets
        .filter((s) => s.pending && s.meta.status !== 'unimplemented')
        .map((s) => `${s.label}: registers pending but its status is '${s.meta.status}'`);
      expect(bad).toEqual([]);
    });
  });
});

describe('hand-maintained docs stay in step with the sheets', () => {
  /** Every `- [Name](…comparison.md)` link target in the index, by node type. */
  const indexed = new Set(
    [...readFileSync(COMPARISON_INDEX, 'utf8').matchAll(/^- \[([^\]]+)\]\([^)]*comparison\.md\)/gm)].map(
      (m) => m[1]
    )
  );

  it('lists every slice sheet, so a new node cannot be absent from the index', () => {
    // The index covers node types, not the loose showcase sheets.
    const sliceTypes = sheets
      .filter((s) => s.file.includes(`${sep}nodes${sep}`) && s.meta.type)
      .map((s) => s.meta.type);
    const missing = [...new Set(sliceTypes)].filter((t) => !indexed.has(t)).sort();
    expect(missing).toEqual([]);
  });

  it('lists no node the sheets no longer define', () => {
    const known = new Set(sheets.map((s) => s.meta.type).filter(Boolean));
    const stale = [...indexed].filter((t) => !known.has(t)).sort();
    expect(stale).toEqual([]);
  });

  it("states a node count the ledger agrees with, held to the README's own phrasing", () => {
    // An exact "All N" claim must match exactly. An "Around N" claim may trail
    // the truth by the rounding "Around" implies.
    const readme = readFileSync(ROOT_README, 'utf8');
    const sheetTypes = new Set(
      sheets.filter((s) => s.file.includes(`${sep}nodes${sep}`) && s.meta.type).map((s) => s.meta.type)
    );

    const exact = /All (\d+) of Godot [\d.]+'s instantiable node types/.exec(readme);
    if (exact) {
      // Counted against ClassDB, not the sheet directory: `AreaLight3D` has a
      // sheet but is absent from 4.6.3's ClassDB.
      const catalogued = new Set(
        JSON.parse(readFileSync(join(HERE, 'node-catalog.json'), 'utf8')).nodes.map((n) => n.name)
      );
      const instantiable = [...sheetTypes].filter((t) => catalogued.has(t));
      expect(Number(exact[1])).toBe(instantiable.length);
      return;
    }

    const actual = sheetTypes.size;

    const around = Number(/Around (\d+) node types/.exec(readme)?.[1] ?? NaN);
    expect(Math.abs(around - actual)).toBeLessThanOrEqual(5);
  });
});
