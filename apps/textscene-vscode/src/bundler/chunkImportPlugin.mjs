/**
 * esbuild plugin: routes every dynamic import of a chunk in a split build through the webview's
 * chunk importer (src/webview/chunkImport.ts), which loads a cut-off chunk once more. Only the
 * output names a chunk's file, so the plugin rewrites the written files.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

/** The global the webview's chunk importer installs. A test checks it against chunkImport.ts. */
export const CHUNK_IMPORTER = '__textsceneImportChunk';

/**
 * @param {string} code - one output file of the build
 * @param {string[]} chunkSpecifiers - the specifiers, relative to that file, of the chunks it imports
 * @returns {string} the code with each `import("<chunk>")` replaced by an importer call
 */
export function rewriteChunkImports(code, chunkSpecifiers) {
  const chunks = new Set(chunkSpecifiers);
  // One pass, not one per chunk: the entry is megabytes and imports many chunks.
  return code.replace(/import\(("\.\.?\/[^"]+")\)/g, (call, quoted) =>
    chunks.has(JSON.parse(quoted)) ? `${CHUNK_IMPORTER}(${quoted},import.meta.url)` : call
  );
}

/**
 * The specifiers of the chunks `outputPath` imports dynamically, as esbuild writes them.
 *
 * @param {string} outputPath - a metafile output key, relative to the working directory
 * @param {import('esbuild').Metafile['outputs'][string]} output
 * @returns {string[]}
 */
function dynamicChunkSpecifiers(outputPath, output) {
  return output.imports
    .filter((imported) => imported.kind === 'dynamic-import' && !imported.external)
    .map((imported) => `./${path.posix.relative(path.posix.dirname(outputPath), imported.path)}`);
}

/** @returns {import('esbuild').Plugin} */
export function chunkImportPlugin() {
  return {
    name: 'chunk-import',
    setup(build) {
      if (!build.initialOptions.metafile)
        throw new Error('chunkImportPlugin expected metafile: true, got none');
      const workingDir = build.initialOptions.absWorkingDir ?? process.cwd();
      build.onEnd(async (result) => {
        if (!result.metafile) return;
        await Promise.all(
          Object.entries(result.metafile.outputs).map(async ([outputPath, output]) => {
            const specifiers = dynamicChunkSpecifiers(outputPath, output);
            if (specifiers.length === 0) return;
            const file = path.resolve(workingDir, outputPath);
            await writeFile(file, rewriteChunkImports(await readFile(file, 'utf8'), specifiers));
          })
        );
      });
    },
  };
}
