import { describe, expect, it } from 'vitest';
import { chunkGraphOf } from '../../apps/textscene-web/scripts/chunkGraph.mjs';

const ROOT = '/repo/apps/web';

const BUNDLE = {
  'index.js': {
    type: 'chunk',
    fileName: 'index.js',
    isEntry: true,
    facadeModuleId: `${ROOT}/index.html`,
    imports: ['three.js'],
    modules: { [`${ROOT}/src/main.ts`]: {} },
  },
  'three.js': {
    type: 'chunk',
    fileName: 'three.js',
    isEntry: false,
    facadeModuleId: null,
    imports: [],
    modules: { '/repo/node_modules/three/build/three.module.js': {}, '\0rolldown/runtime.js': {} },
  },
  'index.css': { type: 'asset', fileName: 'index.css' },
};

const MODULES = {
  [`${ROOT}/index.html`]: { importedIds: [`${ROOT}/src/main.ts`], dynamicallyImportedIds: [] },
  [`${ROOT}/src/main.ts`]: {
    importedIds: ['/repo/node_modules/three/build/three.module.js'],
    dynamicallyImportedIds: [`${ROOT}/src/lazy.ts`],
  },
  [`${ROOT}/src/barrel.ts`]: { importedIds: [`${ROOT}/src/main.ts`], dynamicallyImportedIds: [] },
};

const graphOf = () =>
  chunkGraphOf(BUNDLE, (id) => MODULES[id] ?? null, {
    root: ROOT,
    edition: 'dev',
    moduleIds: Object.keys(MODULES),
  });

describe('chunkGraphOf', () => {
  it('lists each chunk with its imports and its modules, relative to the root', () => {
    expect(graphOf().chunks).toEqual([
      { fileName: 'index.js', isEntry: true, imports: ['three.js'], modules: ['src/main.ts'] },
      {
        fileName: 'three.js',
        isEntry: false,
        imports: [],
        modules: ['../../node_modules/three/build/three.module.js', '\0rolldown/runtime.js'],
      },
    ]);
  });

  it('names the edition and the entry modules', () => {
    expect(graphOf()).toMatchObject({ edition: 'dev', entryModules: ['index.html'] });
  });

  it('keeps the static imports of a module no chunk holds', () => {
    expect(graphOf().staticImports['src/barrel.ts']).toEqual(['src/main.ts']);
  });

  it('lists each dynamic import() target of a chunk module', () => {
    expect(graphOf().dynamicTargets).toEqual(['src/lazy.ts']);
  });
});
