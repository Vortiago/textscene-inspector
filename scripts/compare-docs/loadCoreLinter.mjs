/**
 * Imports the built `@textscene/core` linter from a plain Node script. `dist/`
 * keeps extensionless relative specifiers, which Node's ESM resolver rejects, so
 * a process-wide resolve hook retries them with `.js` and `/index.js`. The hook
 * registers before the load, so the load is a dynamic import. Each import names
 * its file literally and destructures what it reads, so `testOnlyExports.mjs`
 * sees which exports a script uses.
 */

import { registerHooks } from 'node:module';

// `registerHooks` arrived in Node 22.15/23.5. `engines` requires >=24 but is
// advisory, so this names the requirement instead of `is not a function`.
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
    const { validatorRegistry, ruleRegistry, resourceRuleRegistry, registeredTypes } =
      await import('../../packages/textscene-core/dist/linter/index.js');
    return { validatorRegistry, ruleRegistry, resourceRuleRegistry, registeredTypes };
  } catch (err) {
    throw new Error(
      'Could not load the built linter.\n' +
        'Run `pnpm --filter @textscene/core build` first.\n' +
        `Underlying error: ${err.message}`,
      { cause: err }
    );
  }
}

/**
 * `nodeRegistry` with every slice's lenient parser self-registered: the linter
 * barrel registers no parser, so `TscnParser.js` runs the `index.js` side
 * effects. The parser is React/THREE-free (ADR-0001), the r3f registries are
 * not, so anything needing those reads source.
 */
export async function loadCoreParser() {
  try {
    await import('../../packages/textscene-core/dist/parser/TscnParser.js');
    const { nodeRegistry } = await import('../../packages/textscene-core/dist/core/NodeRegistry.js');
    return { nodeRegistry };
  } catch (err) {
    throw new Error(
      'Could not load the built parser.\n' +
        'Run `pnpm --filter @textscene/core build` first.\n' +
        `Underlying error: ${err.message}`,
      { cause: err }
    );
  }
}

/**
 * `CLASS_BASE_TYPES`, the class to base-type table `findValidator` walks, for
 * nodes and resources both: `StandardMaterial3D` registers its properties on
 * `BaseMaterial3D`. The linter barrel does not re-export it.
 */
export async function loadClassBaseTypes() {
  const { CLASS_BASE_TYPES } =
    await import('../../packages/textscene-core/dist/godot/classdb/classBaseTypes.js');
  return CLASS_BASE_TYPES;
}

/**
 * `RADIAN_ROUNDTRIP_EPSILON`, the slack `v.radians` adds to a converted degree
 * bound. Read from the built module, not retyped, so the ledger cannot drift.
 */
export async function loadRadianEpsilon() {
  const { RADIAN_ROUNDTRIP_EPSILON } =
    await import('../../packages/textscene-core/dist/linter/validators/v/floats.js');
  return RADIAN_ROUNDTRIP_EPSILON;
}

/**
 * `degToRad`, the Godot-rounding degree conversion. Read from the built module,
 * not retyped, so a script converts as the previewer does.
 */
export async function loadDegToRad() {
  const { degToRad } = await import('../../packages/textscene-core/dist/godot/math/math.js');
  return degToRad;
}
