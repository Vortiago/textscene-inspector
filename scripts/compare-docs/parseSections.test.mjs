/**
 * `parseSections` (gallery/sheetParsing.mjs): a `## Heading` then, after any
 * blank lines, a `<!-- compare: … -->` marker. `renderBody` drops the marker
 * line, so a marker attached to no heading must fail loudly, not vanish.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { build } from './gallery/build.mjs';
import { parseSections } from './gallery/sheetParsing.mjs';
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
    // A section's own prose must not take in the next heading.
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
    // A freshly scaffolded slice: no capture target for recapture and no
    // broken reference to report. Adding `image:` asks for the first capture.
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
