import { describe, expect, it } from 'vitest';
import {
  fixturePrefix,
  importClosure,
  isEngineTestInput,
  readsEngineTestInput,
  relativeSpecifiers,
  sceneLiterals,
} from './engineTestInputs.mjs';

describe('relativeSpecifiers', () => {
  it('reads an import and a re-export, and leaves a package out', () => {
    const src = `import { a } from './a.mjs';\nexport { b } from "../b/b.mjs";\nimport { PNG } from 'pngjs';`;
    expect(relativeSpecifiers(src)).toEqual(['./a.mjs', '../b/b.mjs']);
  });
});

describe('sceneLiterals', () => {
  it('reads each scene a source names', () => {
    const src = `join(dir, 'scenes', 'a.tscn'); join(ROOT, "scenes/fixtures/nested/unit-b.tscn")`;
    expect(sceneLiterals(src)).toEqual(['a.tscn', 'scenes/fixtures/nested/unit-b.tscn']);
  });
});

describe('fixturePrefix', () => {
  it('names the file of a top-level fixture, with or without the fixtures folder', () => {
    expect(fixturePrefix('scenes/fixtures/unit-line2d.tscn')).toBe('scenes/fixtures/unit-line2d.tscn');
    expect(fixturePrefix('unit-line2d.tscn')).toBe('scenes/fixtures/unit-line2d.tscn');
  });

  it('names the folder of a nested fixture, which holds what the scene loads (edge case)', () => {
    expect(fixturePrefix('label3d/unit-label3d.tscn')).toBe('scenes/fixtures/label3d/');
  });
});

describe('importClosure', () => {
  const sources = {
    'scripts/godot-ref/run.engine.test.mjs': `import { r } from './run.mjs';\nimport { m } from '../../core/math.ts';`,
    'scripts/godot-ref/run.mjs': `import { c } from '../visual/contract.mjs';\nimport { r } from './run.mjs';`,
    'scripts/visual/contract.mjs': `import { gone } from './gone.js';`,
    'core/math.ts': '',
    'scripts/godot-ref/diff.mjs': '',
  };
  const closure = importClosure(['scripts/godot-ref/run.engine.test.mjs'], (path) => sources[path]);

  it('follows relative imports from the entry, through a cycle', () => {
    expect([...closure].sort()).toEqual([
      'core/math.ts',
      'scripts/godot-ref/run.engine.test.mjs',
      'scripts/godot-ref/run.mjs',
      'scripts/visual/contract.mjs',
    ]);
  });

  it('leaves out a specifier that names no file (edge case)', () => {
    expect(closure.has('scripts/visual/gone.js')).toBe(false);
  });
});

describe('readsEngineTestInput', () => {
  const inputs = {
    modules: new Set(['scripts/godot-ref/run.mjs', 'scripts/visual/contract.mjs']),
    fixturePrefixes: ['scenes/fixtures/unit-line2d.tscn', 'scenes/fixtures/label3d/'],
  };

  it('takes a module the tests import, inside the harness folder or outside it', () => {
    expect(readsEngineTestInput('scripts/godot-ref/run.mjs', inputs)).toBe(true);
    expect(readsEngineTestInput('scripts/visual/contract.mjs', inputs)).toBe(true);
  });

  it('takes a scene or a script of the harness, which no import names', () => {
    expect(readsEngineTestInput('scripts/godot-ref/scenes/preview-lighting.tscn', inputs)).toBe(true);
    expect(readsEngineTestInput('scripts/godot-ref/enumerate-nodes.gd', inputs)).toBe(true);
  });

  it('takes a fixture the tests render, and a file beside a nested one', () => {
    expect(readsEngineTestInput('scenes/fixtures/unit-line2d.tscn', inputs)).toBe(true);
    expect(readsEngineTestInput('scenes/fixtures/label3d/font.ttf', inputs)).toBe(true);
  });

  it('leaves out a harness module the tests do not import, a document and another fixture (edge case)', () => {
    expect(readsEngineTestInput('scripts/godot-ref/diff.mjs', inputs)).toBe(false);
    expect(readsEngineTestInput('scripts/godot-ref/render-wait.md', inputs)).toBe(false);
    expect(readsEngineTestInput('scenes/fixtures/unit-other.tscn', inputs)).toBe(false);
  });
});

describe('isEngineTestInput', () => {
  it('reads the inputs of the real-Godot tests off the tree', () => {
    expect(isEngineTestInput('scripts/godot-ref/run.engine.test.mjs')).toBe(true);
    expect(isEngineTestInput('scripts/godot-ref/run.mjs')).toBe(true);
    expect(isEngineTestInput('scripts/visual/preview/appContract.mjs')).toBe(true);
    expect(isEngineTestInput('scripts/godot-ref/run.test.mjs')).toBe(false);
  });
});
