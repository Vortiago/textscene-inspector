/**
 * The static value-import closure of an entry file, for the boundary guards that keep react, three,
 * a Node builtin or a `.tsx` component out of an entry point. A regex, not a parser: it matches what
 * the bundler keeps (statements, side-effect imports, literal dynamic `import('…')`, but no
 * `import type`) without an AST dependency.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { stripComments } from './commentSpans';

/**
 * The specifier of an `import`/`export … from` statement or a side-effect import. Group 2 marks
 * the erased `import type` / `export type` form. Statement level only: an inline
 * `import { type X }` stays, as it does in the bundler's runtime graph.
 */
const SPEC_RE = /(?:^|\n)\s*(import|export)\s+(type\s+)?(?:[^;'"]*?\sfrom\s*)?['"]([^'"]+)['"]/g;

/**
 * A dynamic `import('…')` with a literal specifier, which the bundler keeps as a lazy chunk. A
 * computed specifier is out of contract. Group 1 marks the erased `typeof import('…')` type form.
 * The scan runs over stripComments output, so prose naming `import('x')` never enters.
 */
const DYNAMIC_RE = /\b(typeof\s+)?import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Bare specifiers for the UI frameworks that must never reach a host/linter bundle. */
export const FRAMEWORK_BARE_RE: readonly RegExp[] = [
  /^react$/,
  /^react-dom(\/.*)?$/,
  /^@react-three\//,
  /^three$/,
  /^three\//,
  // Heavier than three itself and reached only through the lazy CSG import site.
  /^three-bvh-csg(\/.*)?$/,
  /^three-mesh-bvh(\/.*)?$/,
];

/**
 * Node builtins that cannot exist in a web-worker host, bare or `node:`-prefixed,
 * including subpaths (`fs/promises`, `stream/web`, ...).
 */
export const NODE_BUILTIN_RE =
  /^(node:)?(fs|path|os|child_process|crypto|http|https|net|stream|util|url|zlib|worker_threads)(\/.*)?$/;

export interface WalkImportClosureOptions {
  /**
   * A bare package specifier to its on-disk source root, so a sibling workspace package resolves
   * into its `src/`: the prefix alone is `<root>/index`, and `<prefix>/sub` is `<root>/sub`.
   */
  packageAliases?: Record<string, string>;
  /**
   * Skips a resolved file: it is neither recorded nor scanned, so its own imports never enter the
   * closure.
   */
  exclude?: (absolutePath: string) => boolean;
  /** The base directory importer labels are relative to. Unset, a label is the absolute path. */
  relativeTo?: string;
}

export interface ImportClosure {
  /** Every source file reached from the entry (absolute paths). */
  files: Set<string>;
  /** Bare (non-workspace) value-import specifier -> importer files that carried it. */
  bareValueImports: Map<string, Set<string>>;
  /** Workspace specifiers (relative or aliased) the resolver could not map to a file. */
  unresolved: string[];
}

/** Whether `spec` should resolve to a workspace file, relative or aliased. */
function isWorkspaceSpecifier(spec: string, aliases: Record<string, string>): boolean {
  if (spec.startsWith('.')) return true;
  return Object.keys(aliases).some((prefix) => spec === prefix || spec.startsWith(prefix + '/'));
}

/** The on-disk source file of a relative or aliased specifier, or null. */
function resolveSpecifier(
  fromFile: string,
  spec: string,
  aliases: Record<string, string>
): string | null {
  let base: string | undefined;
  if (spec.startsWith('.')) {
    base = resolve(dirname(fromFile), spec);
  } else {
    for (const [prefix, root] of Object.entries(aliases)) {
      if (spec === prefix) {
        base = resolve(root, 'index');
        break;
      }
      if (spec.startsWith(prefix + '/')) {
        base = resolve(root, spec.slice(prefix.length + 1));
        break;
      }
    }
  }
  if (base === undefined) return null;

  const candidates: string[] = [];
  if (base.endsWith('.js')) {
    const stem = base.slice(0, -3);
    candidates.push(stem + '.ts', stem + '.tsx');
  } else if (extname(base)) {
    candidates.push(base);
  } else {
    candidates.push(base + '.ts', base + '.tsx');
  }
  candidates.push(resolve(base, 'index.ts'), resolve(base, 'index.tsx'));
  return candidates.find((c) => existsSync(c)) ?? null;
}

/** The static value-import closure of `entry`. */
export function walkImportClosure(
  entry: string,
  options: WalkImportClosureOptions = {}
): ImportClosure {
  const aliases = options.packageAliases ?? {};
  const exclude = options.exclude;
  const relativeTo = options.relativeTo;
  const label = (file: string): string => (relativeTo ? relative(relativeTo, file) : file);

  const files = new Set<string>();
  const bareValueImports = new Map<string, Set<string>>();
  const unresolved: string[] = [];
  const stack = [entry];

  while (stack.length) {
    const file = stack.pop()!;
    if (files.has(file) || exclude?.(file)) continue;
    files.add(file);
    const src = readFileSync(file, 'utf8');

    const follow = (spec: string): void => {
      const resolved = resolveSpecifier(file, spec, aliases);
      if (resolved) {
        stack.push(resolved);
      } else if (isWorkspaceSpecifier(spec, aliases)) {
        unresolved.push(`${spec} (from ${label(file)})`);
      } else {
        let importers = bareValueImports.get(spec);
        if (!importers) bareValueImports.set(spec, (importers = new Set()));
        importers.add(label(file));
      }
    };

    const re = new RegExp(SPEC_RE.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const isTypeOnly = m[2] !== undefined; // the bundler erases `import type` and `export type`
      if (isTypeOnly) continue;
      follow(m[3]!);
    }
    const dyn = new RegExp(DYNAMIC_RE.source, 'g');
    const dynSrc = stripComments(src);
    while ((m = dyn.exec(dynSrc)) !== null) {
      if (m[1] !== undefined) continue; // `typeof import('…')` is type-only and erased
      follow(m[2]!);
    }
  }
  return { files, bareValueImports, unresolved };
}

/** Sorted list of the bare (non-workspace) value-import specifiers in a closure. */
export function bareSpecifiers(closure: ImportClosure): string[] {
  return [...closure.bareValueImports.keys()].sort();
}

/** The `.tsx` files reached by a closure: render components leaking past a boundary. */
export function tsxFiles(closure: ImportClosure): string[] {
  return [...closure.files].filter((f) => f.endsWith('.tsx'));
}
