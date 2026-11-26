import { describe, expect, it } from 'vitest';
import { findEagerLazyOnlyModules, firstPaintChunks } from './webFirstPaint.mjs';

const chunk = (fileName, { isEntry = false, imports = [], modules = [] } = {}) => ({
  fileName,
  isEntry,
  imports,
  modules,
});

const GRAPH = {
  chunks: [
    chunk('index.js', { isEntry: true, imports: ['three.js'], modules: ['/src/main.tsx'] }),
    chunk('three.js', { imports: ['shared.js'], modules: ['/three/build/three.module.js'] }),
    chunk('shared.js', { modules: ['/src/shared.ts'] }),
    chunk('lazy.js', { imports: ['shared.js'], modules: ['/three/examples/GLTFLoader.js'] }),
  ],
  dynamicTargets: ['/three/examples/GLTFLoader.js'],
};

describe('firstPaintChunks', () => {
  it('takes each entry and every chunk its static imports reach, not a dynamic chunk', () => {
    expect(firstPaintChunks(GRAPH).map(({ fileName }) => fileName)).toEqual([
      'index.js',
      'three.js',
      'shared.js',
    ]);
  });
});

describe('findEagerLazyOnlyModules', () => {
  it('finds nothing when each module loaded on demand sits in its own chunk', () => {
    expect(findEagerLazyOnlyModules(GRAPH, firstPaintChunks(GRAPH))).toEqual([]);
  });

  it('finds a dynamic import() target that a first-paint chunk holds', () => {
    const paint = [
      chunk('three.js', { modules: ['/three/build/three.module.js', '/three/examples/GLTFLoader.js'] }),
    ];

    expect(findEagerLazyOnlyModules(GRAPH, paint)).toEqual(['/three/examples/GLTFLoader.js']);
  });

  it('finds a lazy leaf that no dynamic import() reaches itself', () => {
    const paint = [chunk('index.js', { modules: ['/core/dist/ltcTable.generated.js'] })];

    expect(findEagerLazyOnlyModules(GRAPH, paint)).toEqual(['/core/dist/ltcTable.generated.js']);
  });
});
