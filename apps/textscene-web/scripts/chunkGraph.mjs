export const CHUNK_GRAPH_FILE = '.vite/chunk-graph.json';

/**
 * Each chunk's static imports and modules, and every target of a dynamic `import()`.
 *
 * @param {Record<string, import('rollup').OutputChunk | import('rollup').OutputAsset>} bundle
 * @param {(id: string) => import('rollup').ModuleInfo | null} moduleInfo
 */
export function chunkGraphOf(bundle, moduleInfo) {
  const chunks = Object.values(bundle).filter((output) => output.type === 'chunk');
  const modules = chunks.flatMap((chunk) => Object.keys(chunk.modules));
  return {
    chunks: chunks.map(({ fileName, isEntry, imports, modules: chunkModules }) => ({
      fileName,
      isEntry,
      imports,
      modules: Object.keys(chunkModules),
    })),
    dynamicTargets: [...new Set(modules.flatMap((id) => moduleInfo(id)?.dynamicallyImportedIds ?? []))],
  };
}

/** @returns {import('vite').Plugin} */
export function chunkGraph() {
  return {
    name: 'textscene-chunk-graph',
    apply: 'build',
    generateBundle(_options, bundle) {
      const graph = chunkGraphOf(bundle, (id) => this.getModuleInfo(id));
      this.emitFile({ type: 'asset', fileName: CHUNK_GRAPH_FILE, source: JSON.stringify(graph) });
    },
  };
}
