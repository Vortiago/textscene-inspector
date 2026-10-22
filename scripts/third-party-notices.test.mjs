/**
 * Asserts that every file transcribed from Godot source (such as `skyShaders.ts`) or from bcdec or FastLZ is
 * listed in `THIRD-PARTY-NOTICES.md`: the bundle strips the inline MIT notice, and the notices file
 * travels with the VSIX. Detection keys on each copyright line, not a path allowlist, so copying
 * the notice into a new port is what gets it caught.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { NOTICE_SOURCES, bundledNotices, bundledSourceFiles } from './third-party-notices.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const NOTICES = join(REPO_ROOT, 'THIRD-PARTY-NOTICES.md');
const VSCODE_COPY = join(REPO_ROOT, 'apps', 'textscene-vscode', 'THIRD-PARTY-NOTICES.md');

const GODOT_COPYRIGHT = NOTICE_SOURCES.find(({ section }) => section === 'Godot Engine').copyright;
const COPYRIGHTS = NOTICE_SOURCES.map(({ section, copyright }) => [section, copyright]);
/** The third parties whose code the repository's own sources carry, not an installed package's. */
const SOURCE_COPYRIGHTS = NOTICE_SOURCES.filter(({ isInstalled }) => !isInstalled).map(
  ({ section, copyright }) => [section, copyright]
);

/** Trees that can contain derived source. `node_modules` and build output excluded. */
const SEARCH_ROOTS = ['packages', 'scripts', 'apps'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', '.git', 'baselines', 'public']);
const SOURCE_EXT = /\.(ts|tsx|mjs|js)$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(entry)) out.push(full);
  }
  return out;
}

/** Every source file carrying `copyright`, as repo-relative POSIX paths. */
function derivedFiles(copyright) {
  const found = [];
  for (const root of SEARCH_ROOTS) {
    for (const file of walk(join(REPO_ROOT, root))) {
      // The notices test itself contains the pattern; it is not derived source.
      if (file === resolve(import.meta.filename)) continue;
      if (copyright.test(readFileSync(file, 'utf8'))) {
        found.push(relative(REPO_ROOT, file).split(sep).join('/'));
      }
    }
  }
  return found.sort();
}

describe('THIRD-PARTY-NOTICES.md', () => {
  it('exists at the repo root', () => {
    expect(() => readFileSync(NOTICES, 'utf8')).not.toThrow();
  });

  it('carries the full Godot MIT licence text, not just an attribution line', () => {
    const text = readFileSync(NOTICES, 'utf8');
    // A bare copyright line is not a licence grant. The MIT licence requires the permission and
    // warranty clauses.
    expect(text).toMatch(GODOT_COPYRIGHT);
    expect(text).toContain('Permission is hereby granted, free of charge');
    expect(text).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
  });

  it.each(COPYRIGHTS)('carries the %s copyright line', (_name, copyright) => {
    expect(readFileSync(NOTICES, 'utf8')).toMatch(copyright);
  });

  it.each(SOURCE_COPYRIGHTS)('lists every source file that carries the %s copyright', (_name, copyright) => {
    const text = readFileSync(NOTICES, 'utf8');
    const missing = derivedFiles(copyright).filter((file) => !text.includes(file));
    expect(missing, `add these to THIRD-PARTY-NOTICES.md: ${missing.join(', ')}`).toEqual([]);
  });

  it.each(SOURCE_COPYRIGHTS)(
    'finds %s-derived files at all (the scan is not silently matching nothing)',
    (_name, copyright) => {
      // Without this, a broken walk would make the listing assertion vacuously pass.
      expect(derivedFiles(copyright).length).toBeGreaterThan(0);
    }
  );

  it('is byte-identical to the copy shipped in the VSIX', () => {
    // `vsce package` picks up the copy beside the extension's package.json, since `.vscodeignore`
    // is a denylist. The root file is authoritative, and the copy must match it.
    expect(readFileSync(VSCODE_COPY, 'utf8')).toBe(readFileSync(NOTICES, 'utf8'));
  });
});

describe('bundledNotices', () => {
  const notices = readFileSync(NOTICES, 'utf8');
  const godotFile = {
    path: 'packages/textscene-core/src/godot/math/color.ts',
    text: 'Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur',
  };
  const fastlzFile = {
    path: 'packages/textscene-core/src/resources/formats/binaryresource/fastlz.ts',
    text: 'Copyright (C) 2005-2020 Ariya Hidayat',
  };
  const plainFile = { path: 'packages/textscene-core/src/parser/utils.ts', text: 'export {};' };

  it('keeps the preamble and drops every section whose code the bundle lacks', () => {
    const text = bundledNotices(notices, [plainFile]);
    expect(text).toContain('# Third-party notices');
    expect(text).not.toContain('## ');
  });

  it('carries the Godot licence and lists the bundled Godot files only', () => {
    const text = bundledNotices(notices, [godotFile, plainFile]);
    expect(text).toContain('## Godot Engine');
    expect(text).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
    expect(text).toContain(`- \`${godotFile.path}\``);
    expect(text).not.toContain('skyShaders.ts');
    expect(text).not.toContain('## Open Sans font');
  });

  it('carries a section whole when the bundle holds code from it', () => {
    const text = bundledNotices(notices, [fastlzFile]);
    expect(text).toContain('## FastLZ');
    expect(text).toContain('Ariya Hidayat');
    expect(text).not.toContain('## Godot Engine');
  });

  it('carries the notice of an installed package whose licence a bundler strips', () => {
    const noiseFile = {
      path: 'node_modules/fastnoise-lite/FastNoiseLite.js',
      text: '// Copyright(c) 2023 Jordan Peck',
    };

    const text = bundledNotices(notices, [noiseFile, plainFile]);

    expect(text).toContain('## FastNoiseLite');
    expect(text).toContain('Jordan Peck');
    expect(text).not.toContain('## Godot Engine');
  });

  it('carries the font licence when the bundle holds the font', () => {
    const fontFile = {
      path: 'packages/textscene-core/src/r3f/controls/native/text/openSansFontBytes.ts',
      text: '// licence OFL-1.1',
    };

    expect(bundledNotices(notices, [fontFile])).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });
});

describe('bundledSourceFiles', () => {
  const root = mkdtempSync(join(tmpdir(), 'bundled-sources-'));
  afterAll(() => rmSync(root, { recursive: true }));

  function write(path, text) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  write('own/src/index.ts', 'export {};');
  write('core/dist/a.js', 'compiled a');
  write('core/dist/a.js.map', JSON.stringify({ sources: ['../src/a.ts'] }));
  write('core/dist/style.module.css', '.root {}');
  write('node_modules/noise/noise.js', 'noise');
  const where = { packageDir: root, ownSourceDir: join(root, 'own/src') };
  const inputs = [
    'own/src/index.ts',
    'core/dist/a.js',
    'core/dist/style.module.css',
    'node_modules/noise/noise.js',
  ];
  const files = bundledSourceFiles({ inputs: Object.fromEntries(inputs.map((input) => [input, {}])) }, where);
  const pathOf = (inside) => relative(REPO_ROOT, join(root, inside));

  it('names a compiled file by the source its map gives', () => {
    expect(files).toContainEqual({ path: pathOf('core/src/a.ts'), text: 'compiled a' });
  });

  it('names a file of the package or of an installed package where it stands', () => {
    expect(files.map(({ path }) => path)).toEqual(
      expect.arrayContaining([pathOf('own/src/index.ts'), pathOf('node_modules/noise/noise.js')])
    );
  });

  it('leaves out a stylesheet, which holds no code', () => {
    expect(files.map(({ path }) => path)).not.toContain(pathOf('core/dist/style.module.css'));
  });

  it('fails for a compiled file with no source map', () => {
    write('core/dist/bare.js', 'compiled');

    expect(() => bundledSourceFiles({ inputs: { 'core/dist/bare.js': {} } }, where)).toThrow(
      'expected a source map'
    );
  });
});
