/** Which pull requests run only the shader transpiler's own pipeline. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../repoRoot.mjs';
import { changedPathsOf, isShaderOnly, isTranspilerPath, SHADER_BRANCH } from './shaderScope.mjs';

const LANGUAGE = 'packages/textscene-core/src/shaders/language/';
const SHADERS_ENTRY = 'packages/textscene-core/src/shaders/index.ts';

describe('isShaderOnly', () => {
  it('is true for a pull request into the port branch that changes only transpiler files', () => {
    const paths = [
      `${LANGUAGE}parse.ts`,
      'apps/textscene-three-godot-shaders/guide/README.md',
      'scripts/godot-probes/run.mjs',
      'scripts/godot-shader-language/run.mjs',
    ];
    expect(isShaderOnly(paths, SHADER_BRANCH)).toBe(true);
  });

  it('names the branch the port lands on, which keeps its first name', () => {
    expect(SHADER_BRANCH).toBe('feature/shader-translator');
  });

  it('is false when one file is outside the transpiler', () => {
    expect(isShaderOnly([`${LANGUAGE}parse.ts`, SHADERS_ENTRY], SHADER_BRANCH)).toBe(false);
  });

  it.each([
    '.github/workflows/ci.yml',
    '.github/ci-image/Dockerfile',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'tsconfig.base.json',
    'vitest.shared.ts',
    'eslint.config.js',
  ])('is false when the pull request changes the shared input %s', (sharedInput) => {
    expect(isShaderOnly([`${LANGUAGE}parse.ts`, sharedInput], SHADER_BRANCH)).toBe(false);
  });

  it("is false for the port branch's own pull request into main", () => {
    expect(isShaderOnly([`${LANGUAGE}parse.ts`], 'main')).toBe(false);
  });

  it.each(['feature/other', 'feature/shader-translator-old', ''])(
    'is false for a pull request into the base %j',
    (baseRef) => {
      expect(isShaderOnly([`${LANGUAGE}parse.ts`], baseRef)).toBe(false);
    }
  );

  it('is false for an empty diff, which is more likely a broken checkout (edge case)', () => {
    expect(isShaderOnly([], SHADER_BRANCH)).toBe(false);
  });
});

describe('changedPathsOf', () => {
  it('reads one path per line of the diff', () => {
    expect(changedPathsOf(`${LANGUAGE}parse.ts\nscripts/godot-probes/run.mjs\n`)).toEqual([
      `${LANGUAGE}parse.ts`,
      'scripts/godot-probes/run.mjs',
    ]);
  });

  it('gives no path for blank output, so a failed diff runs every job', () => {
    expect(changedPathsOf('')).toEqual([]);
    expect(changedPathsOf('\n  \n')).toEqual([]);
    expect(isShaderOnly(changedPathsOf('\n'), SHADER_BRANCH)).toBe(false);
  });
});

/** The files `file` imports through a relative specifier, as repo-relative paths without extension. */
function relativeImports(file) {
  const text = readFileSync(join(REPO_ROOT, file), 'utf8');
  return [...text.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)].map((match) =>
    normalize(join(dirname(file), match[1])).replace(/\.(?:js|ts|mjs)$/, '')
  );
}

describe('the transpiler is outside every other job', () => {
  // The skipped jobs build the previewer and the extension. A file of theirs that imports the
  // transpiler, or the module entry that re-exports it, would let a skipped job miss a change.
  it('no file outside the transpiler imports it or the module entry that re-exports it', () => {
    const sources = execFileSync('git', ['ls-files', 'packages', 'apps', 'scripts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
      .split('\n')
      .filter((file) => /\.(?:ts|tsx|mjs|js)$/.test(file) && !file.includes('/dist/'))
      .filter((file) => !isTranspilerPath(file) && file !== SHADERS_ENTRY);
    const importers = sources.filter((file) =>
      relativeImports(file).some(
        (target) => target.startsWith(LANGUAGE) || target === SHADERS_ENTRY.replace(/\.ts$/, '')
      )
    );
    expect(importers.filter((file) => !/\.test\.(?:ts|mjs)$/.test(file))).toEqual([]);
  });
});
