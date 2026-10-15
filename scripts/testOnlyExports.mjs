/**
 * Lists the value exports of a package's source tree that no production file imports. Such an
 * export widens a module's interface for its tests alone, so a test reaches past the interface it
 * should go through. The scan is syntactic: it follows relative imports and re-exports, so it runs
 * in seconds over thousands of files where a type-checker program takes minutes.
 */

import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { join, posix, relative } from 'node:path';

const SOURCE_RE = /\.tsx?$/;
const TEST_RE = /\.(test|spec|testkit)\.tsx?$|(^|\/)testing\//;

/** A test, a test kit or a file under `testing/` is a test file. Its imports prove nothing. */
export function isTestFile(path) {
  return TEST_RE.test(path);
}

/** Every `.ts` and `.tsx` file under `dir`, keyed by its path relative to `dir`, POSIX-style. */
export function readSourceTree(dir) {
  const files = new Map();
  const walk = (abs) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const child = join(abs, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walk(child);
      } else if (SOURCE_RE.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        files.set(relative(dir, child).split('\\').join('/'), readFileSync(child, 'utf8'));
      }
    }
  };
  walk(dir);
  return files;
}

/**
 * The resolved file for a relative specifier, or nothing for a bare package or a file outside
 * the tree. Bundler resolution maps `./x.js` to `./x.ts`, and `./dir` to `./dir/index.ts`.
 */
function resolveSpecifier(files, fromPath, specifier) {
  if (!specifier.startsWith('.')) return undefined;
  const base = posix.normalize(posix.join(posix.dirname(fromPath), specifier));
  const stem = base.replace(/\.(m?js|jsx)$/, '');
  const candidates = [base, `${stem}.ts`, `${stem}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.find((candidate) => files.has(candidate));
}

function hasExportModifier(node) {
  return ts.getModifiers?.(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function hasDefaultModifier(node) {
  return ts.getModifiers?.(node)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
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
 * `uses` holds the `[file, name]` pairs it imports, with `*` for a whole module.
 */
function parseModule(files, path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false);
  const record = { own: new Map(), aliases: new Map(), stars: [], uses: [] };
  const imported = new Map();
  const localTypes = new Set(
    source.statements.filter(isTypeDeclaration).flatMap((statement) => declaredNames(statement))
  );

  const visitDynamic = (node) => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [arg] = node.arguments;
      const target = arg && ts.isStringLiteral(arg) && resolveSpecifier(files, path, arg.text);
      if (target) record.uses.push([target, '*']);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      const literal = node.argument.literal;
      const target = ts.isStringLiteral(literal) && resolveSpecifier(files, path, literal.text);
      if (target) record.uses.push([target, node.qualifier ? qualifierHead(node.qualifier) : '*']);
    }
    ts.forEachChild(node, visitDynamic);
  };

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const target = resolveSpecifier(files, path, statement.moduleSpecifier.text);
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
      const target = specifier && resolveSpecifier(files, path, specifier.text);
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
    } else if (hasExportModifier(statement)) {
      const isType = isTypeDeclaration(statement);
      if (hasDefaultModifier(statement)) record.own.set('default', isType);
      else for (const name of declaredNames(statement)) record.own.set(name, isType);
    }
  }
  visitDynamic(source);
  return record;
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
 * that interface, and the declaration emitter needs it exported (TS4023). An entry point's exports
 * are the package interface, so they count as imported, as does everything an entry point
 * forwards. A whole-module use (`import *`, `import()`) imports every export of that module.
 */
export function testOnlyExports(files, entryPoints) {
  const modules = new Map([...files].map(([path, text]) => [path, parseModule(files, path, text)]));
  const imported = new Set();
  // Every hop counts, so a barrel's forwarding name is imported when an importer goes through it.
  const markImported = (file, name) => {
    const seen = new Set();
    for (const [owner, own] of resolveExport(modules, file, name, seen)) imported.add(`${owner}#${own}`);
    for (const hop of seen) imported.add(hop);
  };
  const isTypeOnly = (path, name) =>
    resolveExport(modules, path, name).every(([owner, own]) => modules.get(owner).own.get(own));

  for (const entry of entryPoints) markImported(entry, '*');
  for (const [path, record] of modules) {
    if (isTestFile(path)) continue;
    for (const [file, name] of record.uses) {
      if (file !== path) markImported(file, name);
    }
  }

  const unimported = [];
  for (const [path, record] of modules) {
    if (isTestFile(path)) continue;
    for (const name of [...record.own.keys(), ...record.aliases.keys()]) {
      const id = `${path}#${name}`;
      const isType = record.own.get(name) ?? isTypeOnly(path, name);
      if (!isType && !imported.has(id)) unimported.push(id);
    }
  }
  return unimported.sort();
}

/** The source files a package's `exports` map names under the `@textscene/source` condition. */
export function entryPointsOf(packageJson, sourceDir) {
  return Object.values(packageJson.exports).map((conditions) =>
    posix.relative(sourceDir, posix.normalize(conditions['@textscene/source']))
  );
}
