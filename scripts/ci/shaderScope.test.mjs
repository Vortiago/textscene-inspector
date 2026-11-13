/** Which pull requests run only the shader transpiler's own pipeline. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../repoRoot.mjs';
import { isShaderOnly, isTranspilerPath, SHADER_BRANCH } from './shaderScope.mjs';

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

  it('is false when one file is outside the transpiler', () => {
    expect(isShaderOnly([`${LANGUAGE}parse.ts`, SHADERS_ENTRY], SHADER_BRANCH)).toBe(false);
    expect(isShaderOnly([`${LANGUAGE}parse.ts`, '.github/workflows/ci.yml'], SHADER_BRANCH)).toBe(false);
  });

  it('is false for a pull request into any other branch', () => {
    expect(isShaderOnly([`${LANGUAGE}parse.ts`], 'main')).toBe(false);
  });

  it('is false for an empty diff, which is more likely a broken checkout (edge case)', () => {
    expect(isShaderOnly([], SHADER_BRANCH)).toBe(false);
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
