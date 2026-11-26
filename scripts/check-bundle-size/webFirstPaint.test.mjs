import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkWebFirstPaint,
  findEagerLazyOnlyModules,
  firstPaintChunks,
  staticClosure,
} from './webFirstPaint.mjs';
import { CHUNK_GRAPH_FILE } from '../../apps/textscene-web/scripts/chunkGraph.mjs';

const chunk = (fileName, { isEntry = false, imports = [], modules = [] } = {}) => ({
  fileName,
  isEntry,
  imports,
  modules,
});

const GRAPH = {
  edition: 'dev',
  chunks: [
    chunk('index.js', { isEntry: true, imports: ['three.js'], modules: ['src/main.tsx'] }),
    chunk('three.js', { imports: ['shared.js'], modules: ['three/build/three.module.js'] }),
    chunk('shared.js', { modules: ['src/shared.ts'] }),
    chunk('lazy.js', {
      imports: ['shared.js'],
      modules: ['three/examples/GLTFLoader.js', 'three/examples/fflate.js'],
    }),
  ],
  entryModules: ['index.html'],
  staticImports: {
    'index.html': ['src/main.tsx'],
    'src/main.tsx': ['three/build/three.module.js', 'src/shared.ts'],
    'three/examples/GLTFLoader.js': ['three/examples/fflate.js'],
  },
  dynamicTargets: ['three/examples/GLTFLoader.js'],
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

describe('staticClosure', () => {
  it('reaches through static imports and stops at a dynamic import() target', () => {
    expect([...staticClosure(GRAPH)]).toEqual([
      'index.html',
      'src/main.tsx',
      'three/build/three.module.js',
      'src/shared.ts',
    ]);
  });
});

describe('findEagerLazyOnlyModules', () => {
  it('finds nothing when each module loaded on demand sits in its own chunk', () => {
    expect(findEagerLazyOnlyModules(GRAPH, firstPaintChunks(GRAPH))).toEqual([]);
  });

  it('finds a dynamic import() target that a first-paint chunk holds', () => {
    const paint = [
      chunk('three.js', { modules: ['three/build/three.module.js', 'three/examples/GLTFLoader.js'] }),
    ];

    expect(findEagerLazyOnlyModules(GRAPH, paint)).toEqual(['three/examples/GLTFLoader.js']);
  });

  it('finds a static import of a lazy module that a first-paint chunk holds', () => {
    const paint = [
      chunk('three.js', { modules: ['three/build/three.module.js', 'three/examples/fflate.js'] }),
    ];

    expect(findEagerLazyOnlyModules(GRAPH, paint)).toEqual(['three/examples/fflate.js']);
  });

  it('passes the bundler runtime, which no import names', () => {
    const paint = [chunk('runtime.js', { modules: ['\0rolldown/runtime.js'] })];

    expect(findEagerLazyOnlyModules(GRAPH, paint)).toEqual([]);
  });
});

describe('checkWebFirstPaint', () => {
  let dist;
  beforeEach(() => {
    dist = mkdtempSync(join(tmpdir(), 'first-paint-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    rmSync(dist, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function writeBuild(graph, scriptBytes) {
    const graphPath = join(dist, CHUNK_GRAPH_FILE);
    mkdirSync(dirname(graphPath), { recursive: true });
    writeFileSync(graphPath, JSON.stringify(graph));
    for (const { fileName } of graph.chunks) writeFileSync(join(dist, fileName), scriptBytes);
  }

  it('passes a first paint under its edition ceiling', () => {
    writeBuild(GRAPH, 'export {};');

    expect(checkWebFirstPaint(dist)).toBe('ok');
  });

  it('reports a missing build when no chunk graph exists', () => {
    expect(checkWebFirstPaint(dist)).toBe('missing-build');
  });

  it('fails a graph of an edition with no ceiling', () => {
    writeBuild({ ...GRAPH, edition: 'staging' }, 'export {};');

    expect(checkWebFirstPaint(dist)).toBe('unknown-edition');
  });

  it('fails a first-paint chunk that holds a module loaded on demand', () => {
    const chunks = GRAPH.chunks.map((c) =>
      c.fileName === 'three.js' ? { ...c, modules: [...c.modules, 'three/examples/fflate.js'] } : c
    );
    writeBuild({ ...GRAPH, chunks }, 'export {};');

    expect(checkWebFirstPaint(dist)).toBe('eager-lazy-only');
  });

  it('fails a first paint over its edition ceiling', () => {
    writeBuild(GRAPH, randomBytes(1_000_000));

    expect(checkWebFirstPaint(dist)).toBe('over-budget');
  });
});

/** Bytes gzip cannot shrink, so three chunks of them pass the ceiling. */
function randomBytes(length) {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}
