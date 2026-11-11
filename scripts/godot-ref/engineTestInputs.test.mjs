import { describe, expect, it } from 'vitest';
import {
  importClosure,
  isEngineTestInput,
  relativeSpecifiers,
  resourceClosure,
  sceneCandidates,
  sceneLiterals,
  wasEngineTestInput,
} from './engineTestInputs.mjs';

describe('relativeSpecifiers', () => {
  it('reads an import and a re-export, and leaves a package out', () => {
    const src = `import { a } from './a.mjs';\nexport { b } from "../b/b.mjs";\nimport { PNG } from 'pngjs';`;
    expect(relativeSpecifiers(src)).toEqual(['./a.mjs', '../b/b.mjs']);
  });

  it('reads an import for its side effect and a dynamic import (edge case)', () => {
    const src = `import './register.mjs';\nconst late = await import('../late/late.mjs');`;
    expect(relativeSpecifiers(src)).toEqual(['./register.mjs', '../late/late.mjs']);
  });
});

describe('sceneLiterals', () => {
  it('reads each scene a source names', () => {
    const src = `join(dir, 'scenes', 'a.tscn'); join(ROOT, "scenes/fixtures/nested/unit-b.tscn")`;
    expect(sceneLiterals(src)).toEqual(['a.tscn', 'scenes/fixtures/nested/unit-b.tscn']);
  });
});

describe('sceneCandidates', () => {
  it('takes a path from the repository root as it stands', () => {
    expect(sceneCandidates('scenes/fixtures/nested/unit-b.tscn')).toEqual([
      'scenes/fixtures/nested/unit-b.tscn',
    ]);
  });

  it('looks for a bare name among the harness scenes and the fixtures', () => {
    expect(sceneCandidates('nested/unit-b.tscn')).toEqual([
      'scripts/godot-ref/scenes/nested/unit-b.tscn',
      'scenes/fixtures/nested/unit-b.tscn',
    ]);
  });
});

describe('resourceClosure', () => {
  const sources = {
    'scenes/fixtures/unit-a.tscn': `[ext_resource type="Material" path="res://materials/a.tres" id="1"]\n[ext_resource type="Texture2D" path="res://gone.png" id="2"]`,
    'scenes/fixtures/materials/a.tres': `[ext_resource type="Texture2D" path="res://materials/a.png" id="1"]`,
    'scenes/fixtures/materials/a.png': 'binary path="res://not-a-reference.png"',
    'scenes/fixtures/unit-other.tscn': '',
  };
  const closure = resourceClosure(
    ['scenes/fixtures/unit-a.tscn', 'scenes/fixtures/unit-missing.tscn'],
    (path) => sources[path],
    () => 'scenes/fixtures'
  );

  it('follows each res:// path of a scene and of the text resources it loads', () => {
    expect([...closure].sort()).toEqual([
      'scenes/fixtures/materials/a.png',
      'scenes/fixtures/materials/a.tres',
      'scenes/fixtures/unit-a.tscn',
    ]);
  });

  it('leaves out a scene and a resource that are no file (edge case)', () => {
    expect(closure.has('scenes/fixtures/unit-missing.tscn')).toBe(false);
    expect(closure.has('scenes/fixtures/gone.png')).toBe(false);
  });
});

describe('importClosure', () => {
  const sources = {
    'scripts/godot-ref/run.engine.test.mjs': `import { r } from './run.mjs';\nimport { m } from '../../core/math.ts';`,
    'scripts/godot-ref/run.mjs': `import { c } from '../visual/contract.mjs';\nimport { r } from './run.mjs';`,
    'scripts/visual/contract.mjs': `import { gone } from './gone.js';`,
    'core/math.ts': `import { v } from './vector.js';`,
    'core/vector.ts': '',
    'scripts/godot-ref/diff.mjs': '',
  };
  const closure = importClosure(['scripts/godot-ref/run.engine.test.mjs'], (path) => sources[path]);

  it('follows relative imports from the entry, through a cycle', () => {
    expect([...closure].sort()).toEqual([
      'core/math.ts',
      'core/vector.ts',
      'scripts/godot-ref/run.engine.test.mjs',
      'scripts/godot-ref/run.mjs',
      'scripts/visual/contract.mjs',
    ]);
  });

  it('takes the TypeScript module a .js specifier stands for', () => {
    expect(closure.has('core/vector.ts')).toBe(true);
    expect(closure.has('core/vector.js')).toBe(false);
  });

  it('leaves out a specifier that names no file (edge case)', () => {
    expect(closure.has('scripts/visual/gone.js')).toBe(false);
  });
});

describe('wasEngineTestInput', () => {
  const sceneNames = new Set(['unit-line2d.tscn']);

  it('takes a removed file of the harness, which the tests may have read', () => {
    expect(wasEngineTestInput('scripts/godot-ref/lavapipe.mjs', sceneNames)).toBe(true);
    expect(wasEngineTestInput('scripts/godot-ref/scenes/preview-lighting.tscn', sceneNames)).toBe(true);
  });

  it('takes a removed scene the tests still name', () => {
    expect(wasEngineTestInput('scenes/fixtures/unit-line2d.tscn', sceneNames)).toBe(true);
  });

  it('leaves out a removed document, another scene and a file elsewhere (edge case)', () => {
    expect(wasEngineTestInput('scripts/godot-ref/render-wait.md', sceneNames)).toBe(false);
    expect(wasEngineTestInput('scenes/fixtures/unit-other.tscn', sceneNames)).toBe(false);
    expect(wasEngineTestInput('scripts/visual/run.mjs', sceneNames)).toBe(false);
  });
});

describe('isEngineTestInput', () => {
  it('takes the modules the real-Godot tests and their setup import, in any folder', () => {
    expect(isEngineTestInput('scripts/godot-ref/run.engine.test.mjs')).toBe(true);
    expect(isEngineTestInput('scripts/godot-ref/run.mjs')).toBe(true);
    expect(isEngineTestInput('scripts/godot-ref/engineTools.mjs')).toBe(true);
    expect(isEngineTestInput('scripts/visual/preview/appContract.mjs')).toBe(true);
  });

  it('takes the scenes the tests render, among the harness scenes and the fixtures', () => {
    expect(isEngineTestInput('scripts/godot-ref/scenes/preview-lighting.tscn')).toBe(true);
    expect(isEngineTestInput('scenes/fixtures/unit-line2d.tscn')).toBe(true);
    expect(isEngineTestInput('scenes/fixtures/subviewport-snap-off/unit-subviewport-snap-off.tscn')).toBe(
      true
    );
  });

  it('leaves out a file of the harness that no real-Godot test reads (edge case)', () => {
    expect(isEngineTestInput('scripts/godot-ref/run.test.mjs')).toBe(false);
    expect(isEngineTestInput('scripts/godot-ref/render-wait.md')).toBe(false);
    expect(isEngineTestInput('scripts/godot-ref/scenes/ysort-nested-merge.tscn')).toBe(false);
  });

  it('takes a removed file of the harness, which is in no import closure now (error case)', () => {
    expect(isEngineTestInput('scripts/godot-ref/removed-module.mjs')).toBe(true);
  });
});
