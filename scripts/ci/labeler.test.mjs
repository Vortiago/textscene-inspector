/** Which area labels .github/labeler.yml puts on a pull request, from the paths it changes. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { minimatch } from 'minimatch';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { REPO_ROOT } from '../repoRoot.mjs';

const config = parse(readFileSync(resolve(REPO_ROOT, '.github/labeler.yml'), 'utf8'));

const MATCH_OPTIONS = {
  'any-glob-to-any-file': (globs, paths) => paths.some((path) => globs.some((glob) => matches(path, glob))),
  'all-globs-to-any-file': (globs, paths) => paths.some((path) => globs.every((glob) => matches(path, glob))),
};

// The workflow keeps the action's default `dot: true`, so `.github/**` matches.
function matches(path, glob) {
  return minimatch(path, glob, { dot: true });
}

/** Only the options the config uses are modelled, so another option fails instead of passing unread. */
function optionMatches(option, paths) {
  return Object.entries(option).some(([kind, globs]) => {
    const match = MATCH_OPTIONS[kind];
    if (!match) throw new Error(`expected one of ${Object.keys(MATCH_OPTIONS)}, got ${kind}`);
    return match([globs].flat(), paths);
  });
}

/**
 * Applies the config as actions/labeler v7 does without a top-level `any` or `all` key: a
 * label applies when any of its match options matches.
 */
function labelsFor(paths) {
  return Object.entries(config)
    .filter(([, entries]) =>
      entries.some((entry) => entry['changed-files'].some((option) => optionMatches(option, paths)))
    )
    .map(([label]) => label)
    .sort();
}

function globsOf(label, kind) {
  return config[label].flatMap((entry) =>
    entry['changed-files'].flatMap((option) => [option[kind] ?? []].flat())
  );
}

const core = 'packages/textscene-core/src';
const slice = `${core}/nodes/3d/meshinstance3d`;
const material = `${core}/resources/materials/standardmaterial3d`;

describe('labeler.yml', () => {
  it.each([
    ['scripts/visual/baselines/all-meshes.png', 'goldens'],
    [`${core}/parser/TscnParser.ts`, 'parser'],
    [`${slice}/parser.ts`, 'parser'],
    [`${slice}/parser.test.ts`, 'parser'],
    [`${material}/decode.ts`, 'parser'],
    [`${core}/r3f/TscnCanvas.tsx`, 'renderer'],
    [`${slice}/Component.tsx`, 'renderer'],
    [`${slice}/index.r3f.ts`, 'renderer'],
    [`${material}/build.ts`, 'renderer'],
    [`${core}/linter/index.ts`, 'linter'],
    [`${slice}/linter.ts`, 'linter'],
    [`${slice}/linterParser.ts`, 'linter'],
    [`${slice}/index.linter.ts`, 'linter'],
    ['apps/textscene-linter/src/cli.ts', 'linter'],
    [`${core}/godot/nodeBaseTypes.ts`, 'core'],
    [`${core}/core/NodeRegistry.ts`, 'core'],
    [`${slice}/index.ts`, 'core'],
    [`${slice}/propertyFormatter.ts`, 'core'],
    ['packages/textscene-dev-kit/src/index.ts', 'core'],
    ['apps/textscene-lsp/src/server.ts', 'lsp'],
    [`${core}/languageFeatures/completion.ts`, 'lsp'],
    ['apps/textscene-vscode/src/extension.ts', 'vscode'],
    ['apps/textscene-web/src/r3f-main.tsx', 'web'],
    ['scenes/fixtures/unit-plane-mesh.tscn', 'scenes'],
    ['.github/workflows/ci.yml', 'ci'],
    ['githooks/pre-push', 'ci'],
    ['scripts/ci/visualScope.mjs', 'ci'],
    ['scripts/visual/run.mjs', 'ci'],
    ['docs/adr/0001-record-architecture-decisions.md', 'documentation'],
  ])('labels %s as %s alone', (path, label) => {
    expect(labelsFor([path])).toEqual([label]);
  });

  it('labels a markdown file inside an area with both the area and documentation', () => {
    expect(labelsFor(['apps/textscene-vscode/README.md'])).toEqual(['documentation', 'vscode']);
  });

  it('gives a pull request one label per area it touches', () => {
    expect(labelsFor([`${slice}/Component.tsx`, `${core}/godot/nodeBaseTypes.ts`])).toEqual([
      'core',
      'renderer',
    ]);
  });

  it('excludes from core exactly the core globs the other areas claim', () => {
    const claimed = ['parser', 'renderer', 'linter', 'lsp']
      .flatMap((label) => globsOf(label, 'any-glob-to-any-file'))
      .filter((glob) => glob.startsWith('packages/textscene-core/'));
    const excluded = globsOf('core', 'all-globs-to-any-file')
      .filter((glob) => glob.startsWith('!'))
      .map((glob) => glob.slice(1));
    expect(excluded.sort()).toEqual(claimed.sort());
  });

  it('leaves a root toolchain file unlabelled', () => {
    expect(labelsFor(['pnpm-lock.yaml'])).toEqual([]);
  });
});
