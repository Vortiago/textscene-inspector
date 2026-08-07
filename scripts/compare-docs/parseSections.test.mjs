/**
 * `parseSections` (build-gallery.mjs) turns a sheet body into intro prose plus
 * its per-property comparison sections. A section is a `## Heading` followed by
 * a `<!-- compare: … -->` marker; historically that adjacency had to be
 * IMMEDIATE, so a heading separated from its marker by a blank line — ordinary
 * Markdown, and what `PointLight2D`'s comparison.md actually writes in four of
 * its seven sections — fell through to plain prose with no rendered widget, and
 * did so silently: the marker line itself is an HTML comment `renderBody` drops,
 * so nothing in the output even hints a section went missing.
 *
 * These tests pin the fix (blank lines tolerated) and the backstop (a marker
 * that STILL isn't attached to a heading fails loudly instead of vanishing).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { build, parseSections } from './build-gallery.mjs';
import { collectSheetFiles, parseFrontmatter, sheetLabel } from './sheetSources.mjs';

describe('parseSections', () => {
  it('parses a marker on the line immediately following its heading', () => {
    const body = `## Metallic\n<!-- compare: image=unit-metallic status=done fixture=unit-metallic.tscn -->\n\nBody prose.\n`;
    const { sections, orphaned } = parseSections(body);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
      title: 'Metallic',
      image: 'unit-metallic',
      status: 'done',
      fixture: 'unit-metallic.tscn',
    });
    expect(sections[0].body).toBe('Body prose.');
    expect(orphaned).toEqual([]);
  });

  it('parses a marker separated from its heading by one or more blank lines', () => {
    const body =
      `## Blend modes\n\n<!-- compare: image=unit-blend status=done fixture=unit-blend.tscn -->\n\nThree lights.\n` +
      `## Cull masks\n\n\n<!-- compare: image=unit-cull status=limitation -->\n\nFour panels.\n`;
    const { sections, orphaned } = parseSections(body);
    expect(sections.map((s) => s.title)).toEqual(['Blend modes', 'Cull masks']);
    expect(sections[0]).toMatchObject({ image: 'unit-blend', status: 'done' });
    expect(sections[0].body).toBe('Three lights.');
    expect(sections[1]).toMatchObject({ image: 'unit-cull', status: 'limitation' });
    expect(sections[1].body).toBe('Four panels.');
    expect(orphaned).toEqual([]);
  });

  it('treats a genuinely markerless heading after a section as trailing content', () => {
    const body =
      `## Metallic\n<!-- compare: image=unit-metallic status=done -->\n\nBody prose.\n\n` +
      `## Known limitations\n\nSome caveat that applies to the whole sheet.\n`;
    const { sections, trailing, orphaned } = parseSections(body);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('Metallic');
    // Regression guard: a section's OWN prose must not leak the next heading in.
    expect(sections[0].body).toBe('Body prose.');
    expect(trailing).toContain('## Known limitations');
    expect(trailing).toContain('Some caveat that applies to the whole sheet.');
    expect(orphaned).toEqual([]);
  });

  it('reports a compare marker that never attaches to a heading as orphaned', () => {
    const body =
      `## Metallic\n<!-- compare: image=unit-metallic status=done -->\n\nBody prose.\n\n` +
      `Some paragraph.\n\n<!-- compare: image=unit-orphan status=done -->\n\nDangling prose.\n`;
    const { sections, orphaned } = parseSections(body);
    expect(sections).toHaveLength(1);
    expect(orphaned).toHaveLength(1);
    expect(orphaned[0]).toContain('image=unit-orphan');
  });

  it('does not treat a marker after prose (not just blank lines) as attached to the heading above', () => {
    const body =
      `## Metallic\n\nAn introductory sentence.\n\n<!-- compare: image=unit-metallic status=done -->\n\nBody prose.\n`;
    const { sections, orphaned } = parseSections(body);
    expect(sections).toEqual([]);
    expect(orphaned).toHaveLength(1);
    expect(orphaned[0]).toContain('image=unit-metallic');
  });

  it('yields no sections and no orphans for a legacy single-pair sheet', () => {
    const body = `Just prose, no sections, no markers.\n`;
    const { sections, orphaned, intro } = parseSections(body);
    expect(sections).toEqual([]);
    expect(orphaned).toEqual([]);
    expect(intro).toBe('Just prose, no sections, no markers.');
  });
});

describe('build() orphaned-marker failure', () => {
  const minimalSheet = (body) => ({
    meta: { type: 'FakeType', category: 'Other' },
    body,
  });

  it('fails the build and names the sheet and marker for an orphaned marker', () => {
    const body =
      `# FakeType\n\nSome prose.\n\n<!-- compare: image=unit-fake status=done -->\n\nDangling.\n`;
    const { orphanedMarkers } = build([minimalSheet(body)], false, false);
    expect(orphanedMarkers).toHaveLength(1);
    expect(orphanedMarkers[0]).toContain('FakeType');
    expect(orphanedMarkers[0]).toContain('image=unit-fake');
  });

  it('stays empty for a sheet whose markers are all properly attached', () => {
    const body =
      `# FakeType\n\n## Metallic\n<!-- compare: image=unit-fake status=done -->\n\nBody.\n`;
    const { orphanedMarkers } = build([minimalSheet(body)], false, false);
    expect(orphanedMarkers).toEqual([]);
  });
});

describe('build() missing-image reporting', () => {
  const minimalSheet = (meta, body = '# FakeType\n\nSome prose.\n') => ({
    meta: { type: 'FakeType', category: 'Other', ...meta },
    body,
  });

  it('reports a declared image with no captured file on disk', () => {
    const { missing } = build([minimalSheet({ image: 'unit-nonexistent-for-this-test' })], false, false);
    expect(missing).toHaveLength(1);
    expect(missing[0]).toContain('unit-nonexistent-for-this-test');
  });

  it('stays empty for a sheet that declares no image at all', () => {
    // The state a freshly scaffolded slice ships in: no capture target for
    // recapture, and no broken reference for build-gallery to report. Adding
    // the `image:` key by hand is what asks for the first capture, so a
    // declared-but-absent image has to stay non-fatal — see the reasoning at
    // the `missing` push in build-gallery.mjs.
    const { missing } = build([minimalSheet({})], false, false);
    expect(missing).toEqual([]);
  });
});

describe('PointLight2D comparison.md (the fixture that surfaced this bug)', () => {
  it('every compare marker attaches to a section — none swallowed into prose', () => {
    const file = collectSheetFiles().find((f) => f.includes('pointlight2d/comparison.md'));
    expect(file).toBeTruthy();
    const { meta, body } = parseFrontmatter(readFileSync(file, 'utf8'));
    expect(meta.type).toBe('PointLight2D');
    const { sections, orphaned } = parseSections(body);
    expect(orphaned).toEqual([]);
    expect(sections.map((s) => s.title)).toEqual(
      expect.arrayContaining([
        'Blend modes',
        'An inline gradient cookie, a canvas tint, and an unshaded item',
        'Light Only items',
        'Cull masks: which items a light reaches',
      ])
    );
  });
});

describe('the whole sheet corpus', () => {
  it('carries no orphaned compare marker in any sheet', () => {
    const bad = [];
    for (const file of collectSheetFiles()) {
      const parsed = parseFrontmatter(readFileSync(file, 'utf8'));
      if (!parsed) continue;
      const { orphaned } = parseSections(parsed.body);
      for (const marker of orphaned) bad.push(`${sheetLabel(file)}: ${marker}`);
    }
    expect(bad).toEqual([]);
  });
});
