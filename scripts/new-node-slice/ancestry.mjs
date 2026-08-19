/**
 * Resolving what a new slice INHERITS, from Godot's own ancestry rather than
 * from the coarse `--base` flag. The two diverge whenever a real ancestor owns
 * a parser or a validator set, and taking the flag silently discards it.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { CORE_SRC, REPO_ROOT } from './paths.mjs';

/**
 * Every slice file of one basename, read once.
 *
 * The lookups below ask about one ancestor at a time and there are five to eight
 * of them per scaffold, so a walk per question re-read all ~240 slices each
 * time. The tree is a constant for the length of one invocation, so it is read
 * once and both `ownerOf` lookups scan the same in-memory list.
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
 * Path from `sliceDir` to the linterParser that registers `parentType`.
 *
 * A generated `linterParser.ts` side-effect-imports its parent's so that a test
 * importing only `./linterParser` sees the inherited keys through
 * `findValidator`. The parent is a Godot class, not the `--base` flag: chaining
 * to `base/node3d` when the real parent is `RigidBody3D` skips every validator
 * between them, which is invisible until someone writes such a test. Resolved
 * by scanning for the `registerAll('<Parent>'` that owns the type, so abstract
 * tiers (`physics/shared` for CollisionObject3D) resolve like any other.
 *
 * Falls back to the `--base` slice when the parent registers nothing yet, which
 * is correct: there is no tier to reach.
 */
export function parentLinterParser(typeName, parentType, sliceDir, fallback) {
  /**
   * Directory of the linterParser that registers anything for `<type>`.
   *
   * `registerUnavailable` counts. A class whose whole relationship to its base
   * is subtractive, like `HBoxContainer` fixing the orientation `BoxContainer`
   * exposes, calls ONLY that: matching `registerAll` alone stepped past it and
   * the generated slice never loaded the removal.
   */
  const ownerOf = (type) =>
    soleOwner('linterParser.ts', [`registerAll('${type}'`, `registerUnavailable('${type}'`]);

  // Walk up Godot's chain to the NEAREST ancestor that registers something.
  // `PhysicsBody3D` and `Button` bind nothing and own no slice, so stopping at
  // the immediate parent would skip the tier above them.
  const chain = catalogChain(typeName, [parentType]);
  for (const ancestor of chain) {
    const dir = ownerOf(ancestor);
    if (!dir) continue;
    const rel = relative(sliceDir, dir).replaceAll('\\', '/');
    return `${rel.startsWith('.') ? rel : `./${rel}`}/linterParser.js`;
  }
  return fallback;
}

/**
 * The parse function a `transform-only` / `pending` slice should reuse.
 *
 * The sibling of `parentLinterParser`, and needed for the same reason: `--base`
 * is a coarse flag (node3d/node2d/node/control) while `--chain` is the real
 * Godot parent. They diverge whenever an ancestor has its OWN typed parser, and
 * the split is silent - `SoftBody3D` registered `parseNode3D` while its linter
 * side inherited every MeshInstance3D validator, so `mesh`, `skin` and the
 * material overrides were validated and then discarded, leaving the inspector
 * blank for exactly the properties the sheet advertises.
 *
 * Walks the catalog ancestry to the nearest ancestor that owns a `parser.ts`,
 * falling back to the `--base` slice when none does.
 *
 * @returns `{ importPath, fn }` relative to the slice directory.
 */
export function parentParser(typeName, sliceDir, fallback) {
  const chain = catalogChain(typeName);
  for (const ancestor of chain) {
    const owner = ownerOfParser(ancestor);
    if (!owner) continue;
    const rel = relative(sliceDir, owner).replaceAll('\\', '/');
    return { importPath: `${rel.startsWith('.') ? rel : `./${rel}`}/parser`, fn: `parse${ancestor}` };
  }
  return fallback;
}

/** Directory of the slice whose parser.ts exports `parse<Type>`, if one does. */
export function ownerOfParser(type) {
  return soleOwner('parser.ts', [`export function parse${type}(`]);
}
