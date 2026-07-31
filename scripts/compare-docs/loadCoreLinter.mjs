/**
 * Import the built `@textscene/core` linter from a plain Node script.
 *
 * `packages/textscene-core` is compiled with `tsc --build`, and its sources use
 * extensionless relative specifiers (`import … from '../logger'`). TypeScript
 * emits those verbatim, so `dist/` is bundler-targeted: Vite and esbuild resolve
 * it fine, but Node's ESM resolver rejects an extensionless relative path and the
 * import dies at `dist/linter/RuleRegistry.js -> '../logger'`.
 *
 * Rather than reshape the package's build for one docs generator, register a
 * resolve hook that retries a failed relative specifier with `.js` and
 * `/index.js` — exactly what a bundler does. Scoped to this process.
 *
 * Registration must happen BEFORE the linter is loaded, and static imports are
 * hoisted above statements, so the load is a dynamic import.
 */

import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const LINTER_ENTRY = join(here, '../../packages/textscene-core/dist/linter/index.js');

// Synchronous, in-process, and available from Node 22.15/23.5. `engines` requires
// >=24 but is advisory, so say which requirement was missed rather than dying on
// `registerHooks is not a function`.
if (typeof registerHooks !== 'function') {
  throw new Error(
    `This repository requires Node >= 24 (running ${process.version}): ` +
      'the docs generators load the built linter through module.registerHooks.'
  );
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (!specifier.startsWith('.')) throw err;
      for (const candidate of [`${specifier}.js`, `${specifier}/index.js`]) {
        try {
          return nextResolve(candidate, context);
        } catch {
          // try the next shape
        }
      }
      throw err;
    }
  },
});

/**
 * The live linter registries, with every slice's rules and validators
 * self-registered by the barrel's import side effects.
 */
export async function loadCoreLinter() {
  try {
    return await import(pathToFileURL(LINTER_ENTRY).href);
  } catch (err) {
    throw new Error(
      `Could not load the built linter at ${LINTER_ENTRY}.\n` +
        `Run \`pnpm --filter @textscene/core build\` first.\n` +
        `Underlying error: ${err.message}`,
      { cause: err }
    );
  }
}

/**
 * `NODE_BASE_TYPES` — the node-type → base-type table `findValidator` walks.
 * Not re-exported by the linter barrel, so it is loaded from its own module
 * (the resolve hook above is process-wide, so this works the same way).
 */
export async function loadNodeBaseTypes() {
  const mod = await import(
    pathToFileURL(join(here, '../../packages/textscene-core/dist/linter/nodeBaseTypes.js')).href
  );
  return mod.NODE_BASE_TYPES;
}
