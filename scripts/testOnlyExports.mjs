/**
 * Lists the value exports of a package's source tree that no production file imports. Such an
 * export widens a module's interface for its tests alone, so a test reaches past the interface it
 * should go through. An entry point's export counts as imported only when a file outside the tree
 * imports it. The scan is syntactic: it follows relative imports and re-exports, so it runs in
 * seconds over thousands of files where a type-checker program takes minutes.
 */

import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { join, posix, relative } from 'node:path';

const SOURCE_RE = /\.tsx?$/;
const IMPORTER_RE = /\.(tsx?|m?js)$/;
const TEST_RE = /\.(test|spec|testkit)\.(tsx?|m?js)$|(^|\/)testing\//;

/** Never walked: generated output, installed packages and a downloaded VS Code are nobody's source. */
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'out',
  'build',
  'coverage',
  '.git',
  '.vscode-test',
]);
const DYNAMIC_IMPORT_RE = /\bimport\s*\(/;

/** A test, a test kit or a file under `testing/` is a test file. Its imports prove nothing. */
export function isTestFile(path) {
  return TEST_RE.test(path);
}

/** Every `.ts` and `.tsx` file under `dir`, keyed by its path relative to `dir`, POSIX-style. */
export function readSourceTree(dir) {
  return readFiles(dir, [dir], SOURCE_RE);
}

/**
 * Every source file under `dirs` that may import a package's tree, script files included, keyed by
 * its path relative to `root`, POSIX-style.
 */
export function readImporters(root, dirs) {
  return readFiles(root, dirs, IMPORTER_RE);
}

function readFiles(root, dirs, nameRe) {
  const files = new Map();
  const walk = (abs) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const child = join(abs, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) walk(child);
      } else if (nameRe.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        files.set(relative(root, child).split('\\').join('/'), readFileSync(child, 'utf8'));
      }
    }
  };
  for (const dir of dirs) walk(dir);
  return files;
}

/**
 * The resolved file for a relative specifier, or nothing for a bare package or a file outside
 * the tree.
 */
function resolveSpecifier(files, fromPath, specifier) {
  if (!specifier.startsWith('.')) return undefined;
  return resolveTreePath(files, posix.normalize(posix.join(posix.dirname(fromPath), specifier)));
}

/** The tree file at `base`. Bundler resolution maps `x.js` to `x.ts`, and `dir` to `dir/index.ts`. */
function resolveTreePath(files, base) {
  const stem = base.replace(/\.(m?js|jsx)$/, '');
  const candidates = [base, `${stem}.ts`, `${stem}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.find((candidate) => files.has(candidate));
}

/**
 * A resolver for an importer outside the tree. A package specifier reaches its entry point. A
 * relative one reaches the tree file it names, as a script imports a source file directly or the
 * file `dist`, the tree's build with the same layout, holds for it. It does so
 * only from a production file: an outside test that reaches past the entry points proves nothing,
 * while one that imports a package specifier goes through the package interface.
 */
function outsideResolver(files, { tree, dist, entries }) {
  return (fromPath, specifier) => {
    if (!specifier.startsWith('.')) return entries.get(specifier);
    if (isTestFile(fromPath)) return undefined;
    const target = posix.normalize(posix.join(posix.dirname(fromPath), specifier));
    for (const root of [tree, dist]) {
      if (root && target.startsWith(`${root}/`)) return resolveTreePath(files, target.slice(root.length + 1));
    }
    return undefined;
  };
}

function isTypeDeclaration(statement) {
  return ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement);
}

function declaredNames(statement) {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((d) =>
      ts.isIdentifier(d.name) ? [d.name.text] : []
    );
  }
  return statement.name && ts.isIdentifier(statement.name) ? [statement.name.text] : [];
}

/**
 * One file's module record. `own` holds the names it declares and exports. `aliases` maps an
 * exported name to the `[file, name]` it forwards, and `stars` holds the files `export *` forwards.
 * `uses` holds the `[file, name]` pairs it imports, with `*` for a whole module, and `typeUses`
 * the pairs a type position names through `import('…')`.
 */
function parseModule(path, text, resolve) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false);
  const record = { own: new Map(), aliases: new Map(), stars: [], uses: [], typeUses: [] };
  const imported = new Map();
  const localTypes = new Set(
    source.statements.filter(isTypeDeclaration).flatMap((statement) => declaredNames(statement))
  );

  const visitDynamic = (node) => {
    const destructured = destructuredImport(node);
    if (destructured) {
      const target = resolveDynamic(resolve, path, destructured.call);
      if (target) for (const name of destructured.names) record.uses.push([target, name]);
      return;
    }
    // `await import('./x')` alone loads the module for its side effects and reads no export.
    if (ts.isExpressionStatement(node) && importCallIn(node.expression)) return;
    const thenImport = dynamicImportOfThen(node);
    if (thenImport) {
      const target = resolveDynamic(resolve, path, thenImport.call);
      if (target) for (const name of thenImport.names) record.uses.push([target, name]);
      for (const arg of node.arguments) ts.forEachChild(arg, visitDynamic);
      return;
    }
    if (isDynamicImport(node)) {
      const target = resolveDynamic(resolve, path, node);
      if (target) record.uses.push([target, '*']);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      const literal = node.argument.literal;
      const target = ts.isStringLiteral(literal) && resolve(path, literal.text);
      if (target) record.typeUses.push([target, node.qualifier ? qualifierHead(node.qualifier) : '*']);
    }
    ts.forEachChild(node, visitDynamic);
  };

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const target = resolve(path, statement.moduleSpecifier.text);
      const clause = statement.importClause;
      if (!target || !clause) continue;
      if (clause.name) {
        record.uses.push([target, 'default']);
        imported.set(clause.name.text, [target, 'default']);
      }
      const bindings = clause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) record.uses.push([target, '*']);
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          const name = (element.propertyName ?? element.name).text;
          record.uses.push([target, name]);
          imported.set(element.name.text, [target, name]);
        }
      }
    } else if (ts.isExportDeclaration(statement)) {
      const specifier = statement.moduleSpecifier;
      const target = specifier && resolve(path, specifier.text);
      const clause = statement.exportClause;
      if (specifier && !target) continue;
      if (!clause) record.stars.push(target);
      else if (ts.isNamespaceExport(clause)) record.aliases.set(clause.name.text, [target, '*']);
      else {
        for (const element of clause.elements) {
          const local = (element.propertyName ?? element.name).text;
          const exported = element.name.text;
          if (target) record.aliases.set(exported, [target, local]);
          else if (imported.has(local)) record.aliases.set(exported, imported.get(local));
          else record.own.set(exported, localTypes.has(local));
        }
      }
    } else if (ts.isExportAssignment(statement)) {
      record.own.set('default', false);
    } else if (hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      const isType = isTypeDeclaration(statement);
      if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) record.own.set('default', isType);
      else for (const name of declaredNames(statement)) record.own.set(name, isType);
    }
  }
  // Only a file that writes `import(` holds a dynamic import or an import type to walk for.
  if (DYNAMIC_IMPORT_RE.test(text)) visitDynamic(source);
  return record;
}

function isDynamicImport(node) {
  return ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;
}

function resolveDynamic(resolve, path, call) {
  const [arg] = call.arguments;
  return arg && ts.isStringLiteral(arg) && resolve(path, arg.text);
}

/** The `import('…')` call `expression` awaits or holds, or nothing. */
function importCallIn(expression) {
  let inner = expression;
  while (ts.isAwaitExpression(inner) || ts.isParenthesizedExpression(inner)) inner = inner.expression;
  return isDynamicImport(inner) ? inner : undefined;
}

/** For `const { A, B: b } = await import('./x')`, the import call and the names it binds. */
function destructuredImport(node) {
  if (!ts.isVariableDeclaration(node) || !ts.isObjectBindingPattern(node.name) || !node.initializer) {
    return undefined;
  }
  const call = importCallIn(node.initializer);
  if (!call || node.name.elements.some((element) => element.dotDotDotToken)) return undefined;
  return { call, names: node.name.elements.map((element) => (element.propertyName ?? element.name).text) };
}

/**
 * For `import('./x').then((m) => … m.A …)`, the import call and the names the callback reads.
 * A callback that uses `m` in any other way reads the whole module, written `*`.
 */
function dynamicImportOfThen(node) {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return undefined;
  const { expression: call, name } = node.expression;
  if (name.text !== 'then' || !isDynamicImport(call)) return undefined;
  const [callback] = node.arguments;
  const param = callback && ts.isFunctionLike(callback) && callback.parameters[0]?.name;
  if (!param || !ts.isIdentifier(param)) return { call, names: ['*'] };
  const names = new Set();
  let isWhole = false;
  const visit = (child) => {
    if (ts.isPropertyAccessExpression(child) && ts.isIdentifier(child.expression)) {
      if (child.expression.text === param.text) return void names.add(child.name.text);
    }
    if (ts.isIdentifier(child) && child.text === param.text && child !== param) isWhole = true;
    ts.forEachChild(child, visit);
  };
  ts.forEachChild(callback, visit);
  return { call, names: isWhole ? ['*'] : [...names] };
}

function hasModifier(node, kind) {
  return ts.getModifiers(node)?.some((m) => m.kind === kind) ?? false;
}

function qualifierHead(qualifier) {
  return ts.isIdentifier(qualifier) ? qualifier.text : qualifierHead(qualifier.left);
}

/**
 * Every `[file, name]` an exported name of `path` reaches, following aliases and `export *`.
 * A name reached through a namespace alias marks the whole target module, written `*`.
 */
function resolveExport(modules, path, name, seen = new Set()) {
  const key = `${path}#${name}`;
  if (seen.has(key)) return [];
  seen.add(key);
  const record = modules.get(path);
  if (!record) return [];
  if (name === '*') return allExports(modules, path, seen);
  if (record.own.has(name)) return [[path, name]];
  const alias = record.aliases.get(name);
  if (alias) return resolveExport(modules, alias[0], alias[1], seen);
  return record.stars.flatMap((star) => resolveExport(modules, star, name, seen));
}

function allExports(modules, path, seen) {
  const record = modules.get(path);
  return [
    ...[...record.own.keys()].map((name) => [path, name]),
    ...[...record.aliases].flatMap(([alias, [file, name]]) => {
      seen.add(`${path}#${alias}`);
      return resolveExport(modules, file, name, seen);
    }),
    ...record.stars.flatMap((star) => resolveExport(modules, star, '*', seen)),
  ];
}

/**
 * The `file#name` of every value export in `files` that no production file outside its own file
 * imports. A type export is left out: a type that names an export's argument or result is part of
 * that interface, and the declaration emitter needs it exported (TS4023). An entry point's export
 * is imported only when an `outside` importer imports it, so an entry point hides no export that
 * only tests reach. A whole-module use (`import *`, a bare `import()`) imports every export of
 * that module.
 *
 * `outside.importers` maps each importer's path to its text, relative to the root that `tree`, the
 * path of `files`, and `dist`, the path of its build, are relative to. `outside.entries` maps a
 * package specifier to its entry file.
 */
export function testOnlyExports(files, outside) {
  // A test file's imports prove nothing, so only production files are parsed. `files` still
  // holds every path, so a specifier resolves to a test file as it does to any other.
  const production = [...files].filter(([path]) => !isTestFile(path));
  const insideResolver = (fromPath, specifier) => resolveSpecifier(files, fromPath, specifier);
  const modules = new Map(production.map(([path, text]) => [path, parseModule(path, text, insideResolver)]));
  const imported = new Set();
  // Every hop counts, so a barrel's forwarding name is imported when an importer goes through it.
  const markImported = (file, name) => {
    const seen = new Set();
    for (const [owner, own] of resolveExport(modules, file, name, seen)) imported.add(`${owner}#${own}`);
    for (const hop of seen) imported.add(hop);
  };
  // A name that reaches no parsed declaration, such as one forwarded from a test kit, is a value:
  // `every` over nothing would call it a type and hide it.
  const isTypeOnly = (path, name) => {
    const owners = resolveExport(modules, path, name);
    return owners.length > 0 && owners.every(([owner, own]) => modules.get(owner).own.get(own));
  };

  const resolveOutside = outsideResolver(files, outside);
  for (const [path, text] of outside.importers) {
    const { uses, typeUses, aliases, stars } = parseModule(path, text, resolveOutside);
    // A test types its mock as `typeof import('pkg')`, which names the module, not a use of each export.
    const typed = isTestFile(path) ? [] : typeUses;
    for (const [file, name] of [...uses, ...typed, ...aliases.values()]) markImported(file, name);
    for (const star of stars) if (star) markImported(star, '*');
  }
  for (const [path, record] of modules) {
    for (const [file, name] of [...record.uses, ...record.typeUses]) {
      if (file !== path) markImported(file, name);
    }
  }

  const unimported = [];
  for (const [path, record] of modules) {
    for (const name of [...record.own.keys(), ...record.aliases.keys()]) {
      const id = `${path}#${name}`;
      const isType = record.own.get(name) ?? isTypeOnly(path, name);
      if (!isType && !imported.has(id)) unimported.push(id);
    }
  }
  return unimported.sort();
}

/**
 * Each package specifier mapped to the source file its `exports` entry names under the
 * `@textscene/source` condition: `@textscene/core/godot` to `godot/index.ts`.
 */
export function entryPointsOf(packageJson, sourceDir) {
  return new Map(
    Object.entries(packageJson.exports).map(([subpath, conditions]) => [
      posix.join(packageJson.name, subpath),
      posix.relative(sourceDir, posix.normalize(conditions['@textscene/source'])),
    ])
  );
}
