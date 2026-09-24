/**
 * Resolves what a new slice inherits from Godot's own ancestry, not the coarse `--base` flag. The
 * two diverge whenever a real ancestor owns a parser or a validator set, which the flag discards.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { CORE_SRC, REPO_ROOT, fail } from './paths.mjs';

/**
 * Every slice file of one basename, read once per invocation. A scaffold asks about five to eight
 * ancestors, and a walk per question would re-read every slice each time.
 */
const sliceSources = new Map();
function slicesNamed(basename) {
  let found = sliceSources.get(basename);
  if (found) return found;
  found = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === basename) found.push({ dir: dirname(full), src: readFileSync(full, 'utf8') });
    }
  })(join(CORE_SRC, 'nodes'));
  sliceSources.set(basename, found);
  return found;
}

/** `dir` seen from `sliceDir`, always as an explicit relative specifier. */
function specifier(sliceDir, dir) {
  const rel = relative(sliceDir, dir).replaceAll('\\', '/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

/** The one directory whose `basename` holds any of `needles`, if exactly one does. */
function soleOwner(basename, needles) {
  const found = slicesNamed(basename).filter(({ src }) => needles.some((n) => src.includes(n)));
  return found.length === 1 ? found[0].dir : undefined;
}

/** Godot's ancestry for a type, as `pnpm nodes:catalog` recorded it. */
let catalogCache;
function catalogChain(typeName, fallback = []) {
  catalogCache ??= JSON.parse(
    readFileSync(join(REPO_ROOT, 'scripts/compare-docs/node-catalog.json'), 'utf8')
  );
  return catalogCache.nodes.find((n) => n.name === typeName)?.chain ?? fallback;
}

/**
 * Path from `sliceDir` to the linterParser that registers the nearest registering Godot ancestor,
 * so a test that imports only `./linterParser` sees inherited keys. Chaining to `base/node3d` past
 * a `RigidBody3D` parent would skip its validators. A scan for `registerAll('<Parent>'` also finds
 * an abstract tier (`physics/shared`). With no registering ancestor, it returns the `--base` slice.
 */
export function parentLinterParser(typeName, parentType, sliceDir, fallback) {
  /**
   * Directory of the linterParser that registers anything for `<type>`. `registerUnavailable`
   * counts: `HBoxContainer`, which only fixes the orientation `BoxContainer` exposes, calls only it.
   */
  const ownerOf = (type) =>
    soleOwner('linterParser.ts', [`registerAll('${type}'`, `registerUnavailable('${type}'`]);

  // `PhysicsBody3D` and `Button` bind nothing and own no slice, so the immediate parent alone
  // would skip the tier above them.
  const chain = catalogChain(typeName, [parentType]);
  for (const ancestor of chain) {
    const dir = ownerOf(ancestor);
    if (!dir) continue;
    return `${specifier(sliceDir, dir)}/linterParser.js`;
  }
  return fallback;
}

/**
 * The module specifier `src` imports the name `local` from, if it does. It reads both
 * `import type { X }` and the inline modifier in a value import (`import { Mode, type X }`).
 */
function importSourceOf(src, local) {
  for (const [, names, from] of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
    const bound = names
      .split(',')
      .map((n) => n.trim().replace(/^type\s+/, '').split(/\s+as\s+/).at(-1))
      .filter(Boolean);
    if (bound.includes(local)) return from;
  }
  return undefined;
}

/**
 * The props type `parse<ancestor>` returns and where a slice imports it from, read from the
 * signature: `parseCenterContainer` returns `ControlProperties`, and `HBoxContainer`'s alias
 * re-exports `BoxContainerProperties`. An alias of a name the ancestor does not export does not
 * compile, and one of the `--base` type loses the same properties `parentParser` keeps.
 */
function parentPropsType(ownerDir, ancestor, sliceDir) {
  const src = readFileSync(join(ownerDir, 'parser.ts'), 'utf8');
  const returns = new RegExp(`export function parse${ancestor}\\([\\s\\S]*?\\):\\s*(\\w+)`).exec(src);
  const from = returns && importSourceOf(src, returns[1]);
  if (!from) {
    fail(
      `${ownerDir}/parser.ts: cannot read what parse${ancestor} returns, so the scaffold ` +
        `cannot give the new slice the props type it reuses. Declare an imported return type.`
    );
  }
  return { propsType: returns[1], typesPath: specifier(sliceDir, resolve(ownerDir, from)) };
}

/**
 * The parse function of the nearest catalog ancestor that owns a `parser.ts`, else the `--base`
 * slice's. With `parseNode3D`, a `SoftBody3D` slice would validate the MeshInstance3D keys
 * (`mesh`, `skin`) and then discard them, leaving the inspector blank for them.
 *
 * @returns `{ importPath, fn, propsType, typesPath }` relative to the slice directory.
 */
export function parentParser(typeName, sliceDir, fallback) {
  const chain = catalogChain(typeName);
  for (const ancestor of chain) {
    const owner = ownerOfParser(ancestor);
    if (!owner) continue;
    return {
      importPath: `${specifier(sliceDir, owner)}/parser`,
      fn: `parse${ancestor}`,
      ...parentPropsType(owner, ancestor, sliceDir),
    };
  }
  return fallback;
}

/** Directory of the slice whose parser.ts exports `parse<Type>`, if one does. */
export function ownerOfParser(type) {
  return soleOwner('parser.ts', [`export function parse${type}(`]);
}
