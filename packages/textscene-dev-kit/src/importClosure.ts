/**
 * Static import-closure walker shared by the repo's boundary guards.
 *
 * Several packages assert that a given entry point never *value*-imports a
 * forbidden module (react/three, a Node builtin in a web worker, a `.tsx`
 * render component). Each guard walks the same thing — the transitive
 * static-import graph of an entry file, with type-only imports skipped because
 * the bundler erases them — so the walker lives here once. The guards keep
 * their own entry points, allowed lists, and assertions; they differ only in
 * the options below (which specifiers count as workspace, which files to skip,
 * how to label importers).
 *
 * The walker reads source text and matches import/export statements with a
 * regex rather than a full parser on purpose: it must agree with what the
 * bundler keeps in the runtime graph (statement-level `import`/`export … from`,
 * bare side-effect imports, and literal dynamic `import('…')` expressions;
 * `import type` erased), and a regex pins that contract without an AST
 * dependency.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { stripComments } from './commentSpans';

/**
 * Captures the specifier of any `import`/`export … from` statement and bare
 * side-effect imports. Group 2 is present for the type-only form
 * (`import type` / `export type`), which the bundler erases. Statement-level
 * only by design — inline `import { type X }` is deliberately not special-cased
 * so the walker keeps agreeing with the bundler's runtime graph.
 */
const SPEC_RE = /(?:^|\n)\s*(import|export)\s+(type\s+)?(?:[^;'"]*?\sfrom\s*)?['"]([^'"]+)['"]/g;

/**
 * Dynamic `import('…')` expressions with a literal specifier. The bundler
 * keeps these in the runtime graph (as lazy chunks), so a boundary guard that
 * ignored them would pass green while `await import('three')` ships the
 * forbidden module anyway. Computed specifiers can't be followed statically
 * and are out of contract. Group 1 captures a preceding `typeof` — the
 * `typeof import('…')` type-annotation form is erased by the compiler and
 * must be skipped, matching the `import type` handling above. Comments are
 * blanked before this scan (see stripComments) so prose mentioning
 * `import('x')` never enters the closure.
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
   * Map a bare package specifier to an on-disk source root, so imports of a
   * sibling workspace package resolve into its `src/`. A spec equal to the
   * prefix resolves to `<root>/index`; `<prefix>/sub` resolves to `<root>/sub`.
   */
  packageAliases?: Record<string, string>;
  /**
   * Skip a resolved file entirely — it is neither recorded nor scanned for
   * imports. Evaluated when the file is popped, so an excluded file's own
   * imports never enter the closure.
   */
  exclude?: (absolutePath: string) => boolean;
  /**
   * Base directory for the importer labels in `bareValueImports` and
   * `unresolved`. When set, labels are made relative to it; otherwise the
   * absolute path is used.
   */
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

/** True when `spec` is expected to resolve to a workspace file (relative or aliased). */
function isWorkspaceSpecifier(spec: string, aliases: Record<string, string>): boolean {
  if (spec.startsWith('.')) return true;
  return Object.keys(aliases).some((prefix) => spec === prefix || spec.startsWith(prefix + '/'));
}

/** Resolve a relative or aliased specifier to an on-disk source file, or null. */
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

/** Walk the static *value*-import closure of `entry`. */
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
      const isTypeOnly = m[2] !== undefined; // `import type` / `export type` — erased by the bundler
      if (isTypeOnly) continue;
      follow(m[3]!);
    }
    const dyn = new RegExp(DYNAMIC_RE.source, 'g');
    const dynSrc = stripComments(src);
    while ((m = dyn.exec(dynSrc)) !== null) {
      if (m[1] !== undefined) continue; // `typeof import('…')` — type-only, erased
      follow(m[2]!);
    }
  }
  return { files, bareValueImports, unresolved };
}

/** Sorted list of the bare (non-workspace) value-import specifiers in a closure. */
export function bareSpecifiers(closure: ImportClosure): string[] {
  return [...closure.bareValueImports.keys()].sort();
}

/** The `.tsx` files reached by a closure — a render component leaking past a boundary. */
export function tsxFiles(closure: ImportClosure): string[] {
  return [...closure.files].filter((f) => f.endsWith('.tsx'));
}
