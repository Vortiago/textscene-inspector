import { isAbsolute, relative } from 'node:path';

export const CHUNK_GRAPH_FILE = '.vite/chunk-graph.json';

/**
 * The chunks, the module imports and the dynamic `import()` targets, with ids relative to `root`.
 *
 * @param {Record<string, import('rollup').OutputChunk | import('rollup').OutputAsset>} bundle
 * @param {(id: string) => import('rollup').ModuleInfo | null} moduleInfo
 * @param {{ root: string, edition: string, moduleIds: Iterable<string> }} build
 */
export function chunkGraphOf(bundle, moduleInfo, { root, edition, moduleIds }) {
  const idOf = (id) => (isAbsolute(id) ? relative(root, id) : id);
  const chunks = Object.values(bundle).filter((output) => output.type === 'chunk');
  const modules = chunks.flatMap((chunk) => Object.keys(chunk.modules));
  return {
    edition,
    chunks: chunks.map(({ fileName, isEntry, imports, modules: chunkModules }) => ({
      fileName,
      isEntry,
      imports,
      modules: Object.keys(chunkModules).map(idOf),
    })),
    entryModules: chunks
      .filter((chunk) => chunk.isEntry && chunk.facadeModuleId)
      .map((c) => idOf(c.facadeModuleId)),
    // Every module, not only those a chunk holds: a barrel that renders no code still links its imports.
    staticImports: Object.fromEntries(
      [...moduleIds].map((id) => [idOf(id), (moduleInfo(id)?.importedIds ?? []).map(idOf)])
    ),
    dynamicTargets: [...new Set(modules.flatMap((id) => moduleInfo(id)?.dynamicallyImportedIds ?? []))].map(
      idOf
    ),
  };
}

/**
 * @param {string} edition the site edition the graph names, so the gate reads that edition's ceiling
 * @returns {import('vite').Plugin}
 */
export function chunkGraph(edition) {
  let root = '';
  return {
    name: 'textscene-chunk-graph',
    apply: 'build',
    configResolved(config) {
      root = config.root;
    },
    generateBundle(_options, bundle) {
      const build = { root, edition, moduleIds: this.getModuleIds() };
      const graph = chunkGraphOf(bundle, (id) => this.getModuleInfo(id), build);
      this.emitFile({ type: 'asset', fileName: CHUNK_GRAPH_FILE, source: JSON.stringify(graph) });
    },
  };
}
